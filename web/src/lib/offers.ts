import "server-only";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notifications";
import { generateInvoiceForDeal } from "@/lib/invoice";
import { pushDealToPosIfConnected } from "@/lib/pos-integration";
import type { Terms } from "@/lib/constants";

export type RoundAction = "counter" | "accept" | "reject";
export type ActorRole = "retailer" | "seller";

// Don't notify on every reload — only if the last notification-worthy view
// from this same viewer role was more than this long ago.
const VIEW_NOTIFY_THROTTLE_MS = 10 * 60 * 1000;

// Called whenever a party opens a thread's detail — increments that side's
// view counter and, throttled, alerts the *other* party that their offer
// was viewed (and how many times total). Never notifies the viewer
// themselves, by construction (seller view -> notify retailer, and
// vice versa).
export async function recordThreadView(threadId: string, viewerRole: ActorRole) {
  const thread = await prisma.offerThread.findUnique({
    where: { id: threadId },
    include: { listing: { select: { postedById: true, strainName: true } } },
  });
  if (!thread) return;

  const isSeller = viewerRole === "seller";
  const prevViewedAt = isSeller ? thread.sellerLastViewedAt : thread.retailerLastViewedAt;
  const shouldNotify =
    !prevViewedAt || Date.now() - prevViewedAt.getTime() > VIEW_NOTIFY_THROTTLE_MS;

  const updated = await prisma.offerThread.update({
    where: { id: threadId },
    data: isSeller
      ? { sellerViewCount: { increment: 1 }, sellerLastViewedAt: new Date() }
      : { retailerViewCount: { increment: 1 }, retailerLastViewedAt: new Date() },
  });

  if (!shouldNotify) return;

  const viewCount = isSeller ? updated.sellerViewCount : updated.retailerViewCount;
  const recipientId = isSeller ? thread.retailerId : thread.listing.postedById;
  const viewerLabel = isSeller ? "The seller" : "The retailer";
  await notify(
    recipientId,
    "offer_viewed",
    `${viewerLabel} viewed your offer on ${thread.listing.strainName} (viewed ${viewCount} time${
      viewCount === 1 ? "" : "s"
    } total).`,
    threadId
  );
}

// Shared shape for surfacing a Deal's shipment to the seller/retailer sides —
// transporter identity is real (not anonymized), since transport isn't part
// of the grower/retailer blind boundary, see CLAUDE.md §3/§10.
const DEAL_SHIPMENT_INCLUDE = {
  shipment: {
    include: {
      transporter: { select: { businessName: true, fullName: true } },
      events: { orderBy: { createdAt: "asc" as const } },
    },
  },
  // Only the payer-relevant amount is meaningful to each side — components
  // reading this narrow to growerOwes/retailerOwes per viewer, never show
  // the other party's owed figure as if it were the viewer's own.
  commission: true,
  rejection: true,
};

// No background jobs in this app — same lazy-sweep pattern as
// lib/listings.ts's expireStaleListings, called from every thread read
// path below. See CLAUDE.md §18.
async function expireStaleThreads() {
  await prisma.offerThread.updateMany({
    where: { status: "open", expiresAt: { not: null, lte: new Date() } },
    data: { status: "expired" },
  });
}

// Get-or-create the one thread for a (listing, retailer) pair. An existing
// thread always continues (e.g. a listing that expires mid-negotiation
// doesn't kill an in-flight conversation) — but a *new* thread can't start
// on a listing that's no longer active, expired or not. `expiresAt` is the
// retailer's own choice at the moment they open the negotiation (null =
// no expiration) — see CLAUDE.md §18.
export async function getOrCreateThread(listingId: string, retailerId: string, expiresAt?: Date | null) {
  await expireStaleThreads();
  const existing = await prisma.offerThread.findUnique({
    where: { listingId_retailerId: { listingId, retailerId } },
  });
  if (existing) return existing;

  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing || listing.status !== "active") {
    throw new Error("This listing is no longer active.");
  }

  return prisma.offerThread.create({ data: { listingId, retailerId, expiresAt: expiresAt ?? null } });
}

// The negotiation state machine. Either party can counter any number of
// times while the thread is open; accept closes it and creates a Deal;
// reject closes it with no Deal. See CLAUDE.md §5.
export async function addOfferRound(params: {
  threadId: string;
  actorId: string;
  actorRole: ActorRole;
  action: RoundAction;
  price?: number;
  quantity?: number;
  terms?: Terms;
  message?: string;
  rejectionFeeRate?: number;
  rejectionFeePayer?: "grower" | "retailer" | "split";
}) {
  const thread = await prisma.offerThread.findUnique({
    where: { id: params.threadId },
    include: { listing: true, rounds: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!thread) throw new Error("Thread not found.");
  if (thread.status !== "open") throw new Error("This negotiation is no longer open.");

  // Authorize: the actor must be the thread's retailer, or the listing's
  // seller — never anyone else. This is the same boundary listings.ts
  // enforces on reads; here it's enforced on the write path.
  if (params.actorRole === "retailer" && params.actorId !== thread.retailerId) {
    throw new Error("Not authorized for this negotiation.");
  }
  if (params.actorRole === "seller" && params.actorId !== thread.listing.postedById) {
    throw new Error("Not authorized for this negotiation.");
  }

  const round = await prisma.offerRound.create({
    data: {
      threadId: thread.id,
      actorId: params.actorId,
      actorRole: params.actorRole,
      action: params.action,
      price: params.price ?? null,
      quantity: params.quantity ?? null,
      terms: params.terms ?? null,
      message: params.message ?? null,
      rejectionFeeRate: params.rejectionFeeRate ?? null,
      rejectionFeePayer: params.rejectionFeePayer ?? null,
    },
  });

  const otherPartyId =
    params.actorRole === "seller" ? thread.retailerId : thread.listing.postedById;
  const actorLabel = params.actorRole === "seller" ? "The seller" : "The retailer";

  // The Account Executive who built this listing isn't a party to the
  // negotiation and never sees the anonymized in-progress back-and-forth
  // (they only get real identity once a Deal exists, via
  // threadsForSalesRep) — but they connected the parties, so "did my
  // listing get countered/rejected/accepted" is worth telling them on
  // every outcome, not just a closed non-cash deal. Previously only the
  // accept+non-cash case notified the AE at all; a plain cash accept, any
  // counter, and any reject were all silent to them.
  const assignedRepId = thread.listing.createdBySalesRepId;
  const threadId = thread.id;
  async function notifyAssignedRep(type: string, message: string) {
    if (assignedRepId) {
      await notify(assignedRepId, type, message, threadId);
    }
  }

  if (params.action === "reject") {
    await prisma.offerThread.update({
      where: { id: thread.id },
      data: { status: "rejected" },
    });
    await notify(
      otherPartyId,
      "offer_rejected",
      `${actorLabel} rejected the negotiation on ${thread.listing.strainName}.`,
      thread.id
    );
    await notifyAssignedRep(
      "offer_rejected",
      `${actorLabel} rejected the negotiation on ${thread.listing.strainName}.`
    );
  } else if (params.action === "counter") {
    await notify(
      otherPartyId,
      "offer_countered",
      `${actorLabel} sent a counter-offer on ${thread.listing.strainName}${
        params.price != null ? ` — $${params.price}` : ""
      }.`,
      thread.id
    );
    await notifyAssignedRep(
      "offer_countered",
      `${actorLabel} sent a counter-offer on ${thread.listing.strainName}${
        params.price != null ? ` — $${params.price}` : ""
      }.`
    );
  } else if (params.action === "accept") {
    // Terms of the deal are whatever was most recently on the table — the
    // round being accepted, if it carried terms, otherwise the last prior
    // round's terms, otherwise the listing's original posted terms.
    const lastProposal = thread.rounds[0];
    const finalPrice = params.price ?? lastProposal?.price ?? thread.listing.pricePerUnit;
    const finalQuantity = params.quantity ?? lastProposal?.quantity ?? thread.listing.quantity;
    const finalTerms = params.terms ?? lastProposal?.terms ?? thread.listing.terms;
    // Rejection fee terms — negotiated by the buyer/seller themselves (not
    // broker-set), same resolution pattern as price/quantity/terms above.
    // 0/"split" if it was never discussed — see CLAUDE.md §14.
    const rejectionFeeRate =
      params.rejectionFeeRate ?? lastProposal?.rejectionFeeRate ?? 0;
    const rejectionFeePayer =
      params.rejectionFeePayer ?? lastProposal?.rejectionFeePayer ?? "split";

    const sellerId = thread.listing.postedById;
    const retailerId = thread.retailerId;

    // A cart-order accept (CLAUDE.md §40) can take less than the whole
    // posted quantity — a retailer buying 20 lb out of a 500 lb listing
    // shouldn't close the other 480 lb out of the marketplace. Before that
    // feature, nothing in this app's UI ever let a retailer propose a
    // different quantity than the full listing, so finalQuantity always
    // equaled thread.listing.quantity and this was always a full close —
    // this only changes behavior for the new partial case.
    const remainingQuantity = thread.listing.quantity - finalQuantity;
    const listingUpdateData =
      remainingQuantity > 0 ? { quantity: remainingQuantity } : { status: "closed", quantity: 0 };

    const [, , deal] = await prisma.$transaction([
      prisma.offerThread.update({ where: { id: thread.id }, data: { status: "accepted" } }),
      prisma.listing.update({ where: { id: thread.listingId }, data: listingUpdateData }),
      prisma.deal.create({
        data: {
          threadId: thread.id,
          listingId: thread.listingId,
          sellerId,
          retailerId,
          finalPrice,
          finalQuantity,
          finalTerms,
          rejectionFeeRate,
          rejectionFeePayer,
        },
      }),
    ]);

    // Auto-generate an invoice immediately — the retailer shouldn't be
    // stuck waiting on the grower. The grower can still upload their own
    // file to override it (see lib/shipments.ts's uploadInvoice).
    await generateInvoiceForDeal(deal.id);

    // If the seller has auto-sync POS turned on, log a (currently stub-only)
    // sync attempt — see lib/pos-integration.ts. Never blocks deal creation.
    await pushDealToPosIfConnected(deal.id, sellerId);

    await notify(
      otherPartyId,
      "offer_accepted",
      `${actorLabel} accepted the deal on ${thread.listing.strainName} at $${finalPrice}/${thread.listing.unit}.`,
      thread.id
    );

    // The Account Executive who built this listing isn't a party to the
    // deal and bears no responsibility for whatever terms the grower
    // agreed to (CLAUDE.md §40's disclaimer) — but they're the one who
    // connected the parties, so every closed deal is worth telling them
    // about, not just the non-cash ones. Non-cash terms still get their
    // own more pointed message (the original reason this existed at all —
    // "did the grower agree to something riskier than cash"); a plain
    // cash-terms accept gets a lighter, still-real notification instead
    // of the previous silence.
    if (thread.listing.createdBySalesRepId) {
      await notify(
        thread.listing.createdBySalesRepId,
        finalTerms !== "cash" ? "cart_terms_approved" : "offer_accepted",
        finalTerms !== "cash"
          ? `A deal on ${thread.listing.strainName} closed with "${finalTerms}" terms instead of cash — the grower approved this themselves.`
          : `A deal on ${thread.listing.strainName} closed at $${finalPrice}/${thread.listing.unit}.`,
        thread.id
      );
    }
  }

  return round;
}

// ---------- Retailer-facing (anonymized) ----------

export async function threadsForRetailer(retailerId: string) {
  await expireStaleThreads();
  return prisma.offerThread.findMany({
    where: { retailerId },
    include: {
      rounds: { orderBy: { createdAt: "asc" } },
      listing: {
        select: {
          id: true,
          strainName: true,
          category: true,
          thcPercent: true,
          quantity: true,
          unit: true,
          pricePerUnit: true,
          terms: true,
          media: true,
          postedBy: { select: { anonHandle: true } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}

// One retailer's thread on one listing, if it exists — rounds only, no
// seller identity (the listing itself is already fetched anonymized).
//
// `deal` is explicitly narrowed with `select` (not `include`) because this
// return value flows into a "use client" component (DealPanelRetailer) —
// every prop passed to a Client Component is serialized into the RSC
// payload sent to the browser, regardless of what the component's
// TypeScript type or JSX actually uses. An unnarrowed `include` here would
// have shipped Deal.sellerId (the Grower/Processor's real internal User id)
// to the retailer's browser, undermining the blind-marketplace boundary at
// the query layer exactly the way CLAUDE.md §3/§6 warns against — the UI
// never rendering it isn't enough. Keep this in sync with the `Deal` type
// declared in components/deal/deal-panel-retailer.tsx.
export async function threadForRetailerListing(listingId: string, retailerId: string) {
  await expireStaleThreads();
  return prisma.offerThread.findUnique({
    where: { listingId_retailerId: { listingId, retailerId } },
    include: {
      rounds: { orderBy: { createdAt: "asc" } },
      deal: {
        select: {
          id: true,
          invoiceUrl: true,
          invoiceAutoGenerated: true,
          productStatus: true,
          ...DEAL_SHIPMENT_INCLUDE,
        },
      },
    },
  });
}

// ---------- Seller-facing (anonymized retailer identity) ----------

export async function threadsForSeller(sellerId: string) {
  await expireStaleThreads();
  return prisma.offerThread.findMany({
    where: { listing: { postedById: sellerId } },
    include: {
      rounds: { orderBy: { createdAt: "asc" } },
      listing: { select: { id: true, strainName: true, category: true, pricePerUnit: true, unit: true, terms: true } },
      retailer: { select: { anonHandle: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
}

// Threads for one listing, scoped to that listing's seller — used on the
// seller's listing-detail page. Retailer identity stays anonymized.
//
// `deal` is narrowed the same way as threadForRetailerListing above. This
// side's component (DealPanelSeller) is currently server-only, so this
// isn't shipping retailerId to the browser today — but narrowing here too
// is defense in depth against that component becoming "use client" later
// (for interactivity) and silently reintroducing the same leak.
export async function threadsForListing(listingId: string, sellerId: string) {
  await expireStaleThreads();
  return prisma.offerThread.findMany({
    where: { listingId, listing: { postedById: sellerId } },
    include: {
      rounds: { orderBy: { createdAt: "asc" } },
      retailer: { select: { anonHandle: true } },
      deal: {
        select: {
          id: true,
          invoiceUrl: true,
          invoiceAcceptedAt: true,
          invoiceAutoGenerated: true,
          productStatus: true,
          ...DEAL_SHIPMENT_INCLUDE,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function threadById(threadId: string) {
  return prisma.offerThread.findUnique({
    where: { id: threadId },
    include: {
      listing: { include: { media: true, postedBy: { select: { anonHandle: true } } } },
      retailer: { select: { anonHandle: true } },
      rounds: { orderBy: { createdAt: "asc" } },
    },
  });
}

// ---------- Broker-facing (full, real identity, platform-wide) ----------
// Per CLAUDE.md decision #2, every broker sees every thread and every deal,
// with real identities — this is the only place that's true.

export async function allThreadsForBroker() {
  return prisma.offerThread.findMany({
    include: {
      rounds: { orderBy: { createdAt: "asc" } },
      listing: { include: { postedBy: true, media: true } },
      retailer: true,
      deal: true,
    },
    orderBy: { updatedAt: "desc" },
  });
}

// An Account Executive's own negotiations view — real identity on both
// sides, but scoped to their own assigned accounts only, not
// platform-wide. This is a deliberate, confirmed reversal of the
// blind-marketplace boundary for the AE role specifically: previously an
// AE only ever saw their own client's (the seller's) real identity, never
// the retailer on the other side of a negotiation. Raised directly and
// confirmed by the human before building — same "flag, don't decide
// silently" posture CLAUDE.md already documents for this exact class of
// change (see e.g. §11/§18's own reversals). Admin's equivalent view
// reuses allThreadsForBroker() directly rather than a second function,
// since Admin already has that same unrestricted platform-wide reach.
export async function threadsForSalesRep(salesRepId: string) {
  return prisma.offerThread.findMany({
    where: { listing: { postedBy: { assignedSalesRepId: salesRepId } } },
    include: {
      rounds: { orderBy: { createdAt: "asc" } },
      listing: { include: { postedBy: true, media: true } },
      retailer: true,
      deal: true,
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function allDealsForBroker() {
  return prisma.deal.findMany({
    include: {
      seller: true,
      retailer: true,
      thread: { include: { listing: true } },
      shipment: { include: { transporter: true, events: { orderBy: { createdAt: "asc" } } } },
      commission: true,
    },
    orderBy: { createdAt: "desc" },
  });
}
