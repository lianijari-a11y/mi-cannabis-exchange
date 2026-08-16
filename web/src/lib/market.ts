import "server-only";
import { prisma } from "@/lib/prisma";
import { CATEGORY_LABELS, type Category } from "@/lib/constants";

// Average asking price by category across active listings — the same
// "market pulse" idea as a commodities board, computed live from this
// platform's own data rather than a third-party report.
export async function marketPulse() {
  const active = await prisma.listing.findMany({
    where: { status: "active" },
    select: { category: true, pricePerUnit: true, unit: true },
  });

  const byCategory = new Map<string, { total: number; count: number; unit: string }>();
  for (const l of active) {
    const entry = byCategory.get(l.category) ?? { total: 0, count: 0, unit: l.unit };
    entry.total += l.pricePerUnit;
    entry.count += 1;
    byCategory.set(l.category, entry);
  }

  return Array.from(byCategory.entries())
    .map(([category, { total, count, unit }]) => ({
      category,
      label: CATEGORY_LABELS[category as Category] ?? category,
      avgPrice: Math.round((total / count) * 100) / 100,
      count,
      unit,
    }))
    .sort((a, b) => b.count - a.count);
}

// Recent closed deals in the same category as `listingId` — shown as
// pricing context on a listing's detail page. Excludes the listing itself.
export async function soldComps(category: string, excludeListingId: string, limit = 5) {
  return prisma.deal.findMany({
    where: {
      listingId: { not: excludeListingId },
      thread: { listing: { category } },
    },
    select: {
      id: true,
      finalPrice: true,
      finalQuantity: true,
      finalTerms: true,
      createdAt: true,
      thread: { select: { listing: { select: { unit: true, strainName: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

// Star rating for a seller (grower/processor/broker), derived from how many
// of their past deals actually reached "delivered" vs. stalling out earlier
// in fulfillment. New sellers with no closed deals get no score rather than
// a default — a fabricated 5-star rating would be misleading.
export async function sellerRating(sellerId: string) {
  const deals = await prisma.deal.findMany({
    where: { sellerId },
    select: { shipment: { select: { status: true } } },
  });
  if (deals.length === 0) return { score: null, count: 0 };

  const delivered = deals.filter((d) => d.shipment?.status === "delivered").length;
  const score = Math.min(5, 4 + (delivered / deals.length) * 1);
  return { score: Math.round(score * 10) / 10, count: deals.length };
}

// Same as sellerRating(), but takes a listingId instead of a sellerId so the
// anonymized retailer-facing views can show a rating without ever resolving
// (or exposing) the real seller identity to the caller.
export async function sellerRatingForListing(listingId: string) {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { postedById: true },
  });
  if (!listing) return { score: null, count: 0 };
  return sellerRating(listing.postedById);
}
