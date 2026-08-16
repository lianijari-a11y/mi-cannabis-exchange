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

// Added 2026-08-16 — "who works best" across every role, not just sellers.
// Same honesty rule as sellerRating: no fabricated default for someone with
// no history yet. This app doesn't process real payment (CLAUDE.md §8), so
// "pays on time" is proxied by how quickly a retailer accepts the invoice
// once it's on file — the fastest real signal this app actually has for
// payment reliability, not a made-up number. Rejection rate factors in too:
// a retailer who rejects delivery often is a worse counterparty regardless
// of how fast they otherwise move.
export async function retailerRating(retailerId: string) {
  const deals = await prisma.deal.findMany({
    where: { retailerId },
    select: { createdAt: true, invoiceAcceptedAt: true, productStatus: true },
  });
  if (deals.length === 0) return { score: null, count: 0 };

  const withInvoiceAccept = deals.filter((d) => d.invoiceAcceptedAt);
  const avgAcceptHours =
    withInvoiceAccept.length > 0
      ? withInvoiceAccept.reduce(
          (sum, d) => sum + (d.invoiceAcceptedAt!.getTime() - d.createdAt.getTime()) / 3600000,
          0
        ) / withInvoiceAccept.length
      : null;

  // Speed component: full marks inside 48h, tapering to 0 by 2 weeks.
  const speedScore =
    avgAcceptHours === null ? 0.5 : Math.max(0, Math.min(1, 1 - (avgAcceptHours - 48) / (14 * 24)));
  const rejectedCount = deals.filter((d) => d.productStatus === "rejected").length;
  const reliabilityScore = 1 - rejectedCount / deals.length;

  const score = 3 + speedScore * 1 + reliabilityScore * 1;
  return { score: Math.round(Math.min(5, score) * 10) / 10, count: deals.length };
}

// Transporter rating — % of shipments delivered on/before their scheduled
// window, among shipments that actually had one proposed. Falls back to
// plain delivery-completion rate (same idea as sellerRating) when no
// schedules exist yet, so a transporter isn't left scoreless just because
// nobody's used the new scheduling feature (CLAUDE.md §13) on their loads.
export async function transporterRating(transporterId: string) {
  const shipments = await prisma.shipment.findMany({
    where: { transporterId },
    select: {
      status: true,
      scheduledDeliveryAt: true,
      updatedAt: true,
      events: { where: { status: "delivered" }, select: { createdAt: true } },
    },
  });
  if (shipments.length === 0) return { score: null, count: 0 };

  const scheduled = shipments.filter((s) => s.scheduledDeliveryAt);
  if (scheduled.length > 0) {
    const onTime = scheduled.filter((s) => {
      const deliveredEvent = s.events[0];
      if (!deliveredEvent) return false;
      return deliveredEvent.createdAt.getTime() <= s.scheduledDeliveryAt!.getTime();
    }).length;
    const score = 3 + (onTime / scheduled.length) * 2;
    return { score: Math.round(Math.min(5, score) * 10) / 10, count: scheduled.length };
  }

  const delivered = shipments.filter((s) => s.status === "delivered").length;
  const score = Math.min(5, 4 + (delivered / shipments.length) * 1);
  return { score: Math.round(score * 10) / 10, count: shipments.length };
}

// Same pattern as sellerRatingForListing — resolves a retailer's rating
// through a threadId without ever exposing retailerId to the (seller-side)
// caller.
export async function retailerRatingForThread(threadId: string) {
  const thread = await prisma.offerThread.findUnique({
    where: { id: threadId },
    select: { retailerId: true },
  });
  if (!thread) return { score: null, count: 0 };
  return retailerRating(thread.retailerId);
}

// Added 2026-08-16 — weekly average sold price by category, from this
// platform's own closed Deals. Same "computed live, not a third-party
// report" posture as marketPulse(). Deliberately just numbers/text, no
// charting library added for one widget.
export async function priceTrend(category: string, weeks = 8) {
  const since = new Date(Date.now() - weeks * 7 * 24 * 60 * 60 * 1000);
  const deals = await prisma.deal.findMany({
    where: { createdAt: { gte: since }, thread: { listing: { category } } },
    select: { finalPrice: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const byWeek = new Map<string, { total: number; count: number }>();
  for (const d of deals) {
    const weekStart = new Date(d.createdAt);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const key = weekStart.toISOString().slice(0, 10);
    const entry = byWeek.get(key) ?? { total: 0, count: 0 };
    entry.total += d.finalPrice;
    entry.count += 1;
    byWeek.set(key, entry);
  }

  const points = Array.from(byWeek.entries())
    .map(([weekOf, { total, count }]) => ({
      weekOf,
      avgPrice: Math.round((total / count) * 100) / 100,
      count,
    }))
    .sort((a, b) => a.weekOf.localeCompare(b.weekOf));

  if (points.length < 2) return { points, direction: "flat" as const, changePct: 0 };
  const first = points[0].avgPrice;
  const last = points[points.length - 1].avgPrice;
  const changePct = first > 0 ? Math.round(((last - first) / first) * 1000) / 10 : 0;
  const direction = changePct > 2 ? "up" : changePct < -2 ? "down" : "flat";
  return { points, direction: direction as "up" | "down" | "flat", changePct };
}
