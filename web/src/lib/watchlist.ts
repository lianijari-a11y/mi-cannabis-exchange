import "server-only";
import { prisma } from "@/lib/prisma";

export async function watchlistedIdsFor(retailerId: string): Promise<Set<string>> {
  const entries = await prisma.watchlist.findMany({
    where: { retailerId },
    select: { listingId: true },
  });
  return new Set(entries.map((e) => e.listingId));
}

export async function isWatchlisted(retailerId: string, listingId: string) {
  const entry = await prisma.watchlist.findUnique({
    where: { retailerId_listingId: { retailerId, listingId } },
  });
  return !!entry;
}

export async function toggleWatchlist(retailerId: string, listingId: string) {
  const existing = await prisma.watchlist.findUnique({
    where: { retailerId_listingId: { retailerId, listingId } },
  });
  if (existing) {
    await prisma.watchlist.delete({ where: { id: existing.id } });
    return false;
  }
  await prisma.watchlist.create({ data: { retailerId, listingId } });
  return true;
}

// Active listings a retailer has watchlisted — same anonymized shape as the
// main feed (see lib/listings.ts's activeListingsFeed), just pre-filtered.
export async function watchlistedListings(retailerId: string) {
  const entries = await prisma.watchlist.findMany({
    where: { retailerId, listing: { status: "active" } },
    select: {
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
          expiresAt: true,
          media: true,
          postedBy: { select: { anonHandle: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  return entries.map((e) => e.listing);
}
