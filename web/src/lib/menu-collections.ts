import "server-only";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";

// "An account rep has 14 menus from 14 different growers, all 14 can be
// grouped and shared with one link" (CLAUDE.md §40) — an AE picks several
// of their own menus (each a bulk-upload batch, possibly from different
// growers they're assigned to) and gets one link showing every product
// across all of them.
export async function createMenuCollection(salesRepId: string, batchIds: string[]) {
  if (batchIds.length === 0) throw new Error("Select at least one menu.");
  return prisma.menuCollection.create({ data: { salesRepId, batchIds } });
}

// Every menu (batch) this rep's own assigned accounts have, so they can
// pick which ones to bundle. Reuses the same account-assignment scoping as
// accountsForSalesRep/accountDetailForSalesRep — an AE can only ever
// collect menus belonging to sellers actually assigned to them.
export async function menusForCollectionPicker(salesRepId: string) {
  const sellers = await prisma.user.findMany({
    where: { assignedSalesRepId: salesRepId },
    select: { id: true, businessName: true, fullName: true },
  });
  const sellerIds = sellers.map((s) => s.id);
  if (sellerIds.length === 0) return [];

  const listings = await prisma.listing.findMany({
    where: { postedById: { in: sellerIds } },
    select: { batchId: true, postedById: true, strainName: true, status: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  const sellerNameById = new Map(sellers.map((s) => [s.id, s.businessName ?? s.fullName]));
  const menus = new Map<
    string,
    { batchId: string; sellerName: string; createdAt: Date; productCount: number; activeCount: number }
  >();
  for (const l of listings) {
    const key = l.batchId ?? `__unbatched_${l.postedById}_${l.createdAt.getTime()}`;
    const existing = menus.get(key);
    if (existing) {
      existing.productCount++;
      if (l.status === "active") existing.activeCount++;
      if (l.createdAt < existing.createdAt) existing.createdAt = l.createdAt;
    } else {
      menus.set(key, {
        batchId: key,
        sellerName: sellerNameById.get(l.postedById) ?? "Unknown seller",
        createdAt: l.createdAt,
        productCount: 1,
        activeCount: l.status === "active" ? 1 : 0,
      });
    }
  }
  return Array.from(menus.values())
    .filter((m) => m.activeCount > 0)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function handleCreateMenuCollection(formData: FormData) {
  const session = await requireRole("sales_rep");
  const batchIds = formData.getAll("batchId").map(String);
  const collection = await createMenuCollection(session.user.id, batchIds);
  return collection.id;
}

// The public browse view for a collection link — aggregates every
// currently-shareable product (status "active" AND visibility "all", same
// rule as publicMenuView/publicListingView) across every menu in the
// collection, grouped by seller so a buyer can see it's several growers'
// menus bundled together, not one.
export async function publicCollectionView(collectionId: string) {
  const collection = await prisma.menuCollection.findUnique({ where: { id: collectionId } });
  if (!collection || collection.batchIds.length === 0) return null;

  const listings = await prisma.listing.findMany({
    where: { batchId: { in: collection.batchIds }, status: "active", visibility: "all" },
    select: {
      id: true,
      strainName: true,
      category: true,
      thcPercent: true,
      quantity: true,
      unit: true,
      pricePerUnit: true,
      terms: true,
      batchId: true,
      media: true,
      minimumOrderQuantity: true,
      belowMinimumPricePerUnit: true,
      postedBy: { select: { anonHandle: true } },
    },
    orderBy: [{ batchId: "asc" }, { strainName: "asc" }],
  });
  if (listings.length === 0) return null;

  // Grouped by anonHandle, not the seller's real internal id — that id must
  // never reach a public page (see CLAUDE.md §21's RSC-payload leak finding;
  // every prop handed to a Client Component serializes into what the
  // browser receives, regardless of what the component's own types read).
  const bySeller = new Map<string, { anonHandle: string; listings: typeof listings }>();
  for (const l of listings) {
    const key = l.postedBy.anonHandle;
    const existing = bySeller.get(key);
    if (existing) existing.listings.push(l);
    else bySeller.set(key, { anonHandle: key, listings: [l] });
  }

  return { collectionId, sellers: Array.from(bySeller.values()) };
}
