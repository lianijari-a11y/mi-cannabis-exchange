import "server-only";
import { prisma } from "@/lib/prisma";
import type { Terms } from "@/lib/constants";

export type RoundAction = "counter" | "accept" | "reject";
export type ActorRole = "retailer" | "seller";

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
};

// Get-or-create the one thread for a (listing, retailer) pair. An existing
// thread always continues (e.g. a listing that expires mid-negotiation
// doesn't kill an in-flight conversation) — but a *new* thread can't start
// on a listing that's no longer active, expired or not.
export async function getOrCreateThread(listingId: string, retailerId: string) {
  const existing = await prisma.offerThread.findUnique({
    where: { listingId_retailerId: { listingId, retailerId } },
  });
  if (existing) return existing;

  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing || listing.status !== "active") {
    throw new Error("This listing is no longer active.");
  }

  return prisma.offerThread.create({ data: { listingId, retailerId } });
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
    },
  });

  if (params.action === "reject") {
    await prisma.offerThread.update({
      where: { id: thread.id },
      data: { status: "rejected" },
    });
  } else if (params.action === "accept") {
    // Terms of the deal are whatever was most recently on the table — the
    // round being accepted, if it carried terms, otherwise the last prior
    // round's terms, otherwise the listing's original posted terms.
    const lastProposal = thread.rounds[0];
    const finalPrice = params.price ?? lastProposal?.price ?? thread.listing.pricePerUnit;
    const finalQuantity = params.quantity ?? lastProposal?.quantity ?? thread.listing.quantity;
    const finalTerms = params.terms ?? lastProposal?.terms ?? thread.listing.terms;

    const sellerId = thread.listing.postedById;
    const retailerId = thread.retailerId;

    await prisma.$transaction([
      prisma.offerThread.update({ where: { id: thread.id }, data: { status: "accepted" } }),
      prisma.listing.update({ where: { id: thread.listingId }, data: { status: "closed" } }),
      prisma.deal.create({
        data: {
          threadId: thread.id,
          listingId: thread.listingId,
          sellerId,
          retailerId,
          finalPrice,
          finalQuantity,
          finalTerms,
        },
      }),
    ]);
  }

  return round;
}

// ---------- Retailer-facing (anonymized) ----------

export async function threadsForRetailer(retailerId: string) {
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
export async function threadForRetailerListing(listingId: string, retailerId: string) {
  return prisma.offerThread.findUnique({
    where: { listingId_retailerId: { listingId, retailerId } },
    include: { rounds: { orderBy: { createdAt: "asc" } }, deal: { include: DEAL_SHIPMENT_INCLUDE } },
  });
}

// ---------- Seller-facing (anonymized retailer identity) ----------

export async function threadsForSeller(sellerId: string) {
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
export async function threadsForListing(listingId: string, sellerId: string) {
  return prisma.offerThread.findMany({
    where: { listingId, listing: { postedById: sellerId } },
    include: {
      rounds: { orderBy: { createdAt: "asc" } },
      retailer: { select: { anonHandle: true } },
      deal: { include: DEAL_SHIPMENT_INCLUDE },
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

export async function allDealsForBroker() {
  return prisma.deal.findMany({
    include: {
      seller: true,
      retailer: true,
      thread: { include: { listing: true } },
      shipment: { include: { transporter: true, events: { orderBy: { createdAt: "asc" } } } },
    },
    orderBy: { createdAt: "desc" },
  });
}
