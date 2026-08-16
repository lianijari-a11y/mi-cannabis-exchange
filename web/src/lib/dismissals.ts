import "server-only";
import { prisma } from "@/lib/prisma";

// "Not interested" — same shape as lib/watchlist.ts, opposite intent: hides
// a listing from one retailer's own feed only, reversible.
export async function dismissedIdsFor(retailerId: string): Promise<Set<string>> {
  const entries = await prisma.listingDismissal.findMany({
    where: { retailerId },
    select: { listingId: true },
  });
  return new Set(entries.map((e) => e.listingId));
}

export async function toggleDismissal(retailerId: string, listingId: string) {
  const existing = await prisma.listingDismissal.findUnique({
    where: { retailerId_listingId: { retailerId, listingId } },
  });
  if (existing) {
    await prisma.listingDismissal.delete({ where: { id: existing.id } });
    return false;
  }
  await prisma.listingDismissal.create({ data: { retailerId, listingId } });
  return true;
}
