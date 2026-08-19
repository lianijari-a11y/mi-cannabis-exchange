import "server-only";
import { prisma } from "@/lib/prisma";
import { getOrCreateThread, addOfferRound } from "@/lib/offers";
import type { Terms } from "@/lib/constants";

export type CartItemInput = {
  listingId: string;
  quantity: number;
  price: number;
};

export type SubmitCartOrderResult =
  | { ok: true; cartOrderId: string; threadIds: string[] }
  | { ok: false; error: string };

// Multi-product submission from a menu or collection link (CLAUDE.md §40)
// — one retailer, several products, possibly from several different
// sellers, submitted at once. Deliberately does NOT invent a second
// negotiation state machine: each item still becomes an ordinary
// OfferThread via the exact same getOrCreateThread/addOfferRound used
// everywhere else in this app, just tagged with a shared cartOrderId for
// grouping. A seller still has to accept (or counter, or reject) their own
// line items completely independently — nothing about "it came from a
// cart" changes how any individual negotiation behaves.
export async function submitCartOrder(
  retailerId: string,
  items: CartItemInput[],
  requestedTerms: Terms,
  opts?: { collectionId?: string; facilitatedBySalesRepId?: string; disclaimerAcknowledged?: boolean }
): Promise<SubmitCartOrderResult> {
  if (items.length === 0) return { ok: false, error: "Select at least one product." };

  const listingIds = items.map((i) => i.listingId);
  const listings = await prisma.listing.findMany({
    where: { id: { in: listingIds }, status: "active" },
    select: {
      id: true,
      postedById: true,
      pricePerUnit: true,
      quantity: true,
      unit: true,
      terms: true,
      strainName: true,
      minimumOrderQuantity: true,
      belowMinimumPricePerUnit: true,
    },
  });
  const listingById = new Map(listings.map((l) => [l.id, l]));

  // A Sales Rep relaying this order on a retailer's behalf must have shown
  // (and had acknowledged) the liability disclaimer before we let it
  // through — same "flag, don't quietly proceed" posture as everywhere
  // else this app deals with something legally adjacent.
  if (opts?.facilitatedBySalesRepId && !opts.disclaimerAcknowledged) {
    return { ok: false, error: "The terms disclaimer must be acknowledged before submitting on a retailer's behalf." };
  }

  // Tiered pricing (CLAUDE.md §40) is a soft threshold, never a hard
  // reject — a grower can still sell below their preferred order size,
  // just at whatever price they set for that. The client is expected to
  // already show this price as it builds the cart, but the server
  // recomputes it independently here rather than trusting a submitted
  // price blindly, same posture as every other price-sensitive path in
  // this app.
  function effectivePrice(listing: (typeof listings)[number], quantity: number): number {
    if (
      listing.minimumOrderQuantity != null &&
      listing.belowMinimumPricePerUnit != null &&
      quantity < listing.minimumOrderQuantity
    ) {
      return listing.belowMinimumPricePerUnit;
    }
    return listing.pricePerUnit;
  }

  const cartOrder = await prisma.cartOrder.create({
    data: {
      retailerId,
      collectionId: opts?.collectionId ?? null,
      requestedTerms,
      facilitatedBySalesRepId: opts?.facilitatedBySalesRepId ?? null,
      disclaimerAcknowledgedAt: opts?.disclaimerAcknowledged ? new Date() : null,
    },
  });

  const threadIds: string[] = [];
  for (const item of items) {
    const listing = listingById.get(item.listingId);
    if (!listing) continue; // skip anything that closed/expired between page load and submit

    let thread;
    try {
      thread = await getOrCreateThread(item.listingId, retailerId);
    } catch {
      continue;
    }
    await prisma.offerThread.update({ where: { id: thread.id }, data: { cartOrderId: cartOrder.id } });

    // Accepting as-posted vs. countering follows the exact same rule the
    // single-listing respond flow already uses: matching the listing's
    // real price for this quantity (respecting the below-minimum tier, if
    // any) and its own terms is an accept; anything else — including a
    // retailer trying to push back on the tiered price itself — is a
    // counter, which the seller then reviews normally.
    const isAsPosted =
      item.price === effectivePrice(listing, item.quantity) && requestedTerms === listing.terms;
    await addOfferRound({
      threadId: thread.id,
      actorId: retailerId,
      actorRole: "retailer",
      action: isAsPosted ? "accept" : "counter",
      price: item.price,
      quantity: item.quantity,
      terms: requestedTerms,
    });
    threadIds.push(thread.id);
  }

  if (threadIds.length === 0) {
    return { ok: false, error: "None of the selected products are still available — try again." };
  }

  return { ok: true, cartOrderId: cartOrder.id, threadIds };
}
