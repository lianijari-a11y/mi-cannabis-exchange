import "server-only";
import { prisma } from "@/lib/prisma";
import { generateAnonHandle } from "@/lib/anon-handle";
import { saveMediaFile } from "@/lib/media";
import type { Category, Terms, Unit } from "@/lib/constants";
import { SELLER_ROLES } from "@/lib/constants";

export type NewListingInput = {
  strainName: string;
  category: Category;
  thcPercent: number | null;
  quantity: number;
  unit: Unit;
  pricePerUnit: number;
  terms: Terms;
  notes: string | null;
  expiresAt: Date | null;
};

// No background jobs in this app, so expiration is swept lazily: every read
// path below flips any stale "active" listing to "expired" before querying.
// The `status` column stays the single source of truth (matches the "active
// | expired | closed" comment on the schema) rather than comparing expiresAt
// ad hoc in every query.
async function expireStaleListings() {
  await prisma.listing.updateMany({
    where: { status: "active", expiresAt: { not: null, lte: new Date() } },
    data: { status: "expired" },
  });
}

export async function createListing(
  postedById: string,
  postedByRole: string,
  input: NewListingInput,
  files: File[]
) {
  if (!SELLER_ROLES.includes(postedByRole as (typeof SELLER_ROLES)[number])) {
    throw new Error("Only growers, processors, and brokers can post listings.");
  }

  const listing = await prisma.listing.create({
    data: {
      postedById,
      strainName: input.strainName,
      category: input.category,
      thcPercent: input.thcPercent,
      quantity: input.quantity,
      unit: input.unit,
      pricePerUnit: input.pricePerUnit,
      terms: input.terms,
      notes: input.notes,
      expiresAt: input.expiresAt,
    },
  });

  for (const [i, file] of files.entries()) {
    if (!file || file.size === 0) continue;
    const saved = await saveMediaFile(listing.id, file);
    await prisma.listingMedia.create({
      data: { listingId: listing.id, url: saved.url, type: saved.type, sortOrder: i },
    });
  }

  return listing;
}

// A seller's own listing management view — no counterparty identity involved,
// so no anonymization concern here.
export async function listingsForSeller(sellerId: string) {
  await expireStaleListings();
  return prisma.listing.findMany({
    where: { postedById: sellerId },
    include: { media: true, threads: { include: { rounds: true } } },
    orderBy: { createdAt: "desc" },
  });
}

// The Retailer-facing feed. This is the anonymization boundary: the poster's
// real User row is never selected, only their generated anonHandle. Do not
// add `postedBy: true` (full relation) to this query — see CLAUDE.md §6.
export async function activeListingsFeed() {
  await expireStaleListings();
  return prisma.listing.findMany({
    where: { status: "active" },
    select: {
      id: true,
      strainName: true,
      category: true,
      thcPercent: true,
      quantity: true,
      unit: true,
      pricePerUnit: true,
      terms: true,
      notes: true,
      status: true,
      createdAt: true,
      expiresAt: true,
      media: true,
      postedBy: { select: { anonHandle: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getListingForSeller(listingId: string, sellerId: string) {
  await expireStaleListings();
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: { media: true },
  });
  if (!listing || listing.postedById !== sellerId) return null;
  return listing;
}

// Anonymized single-listing view for a retailer — same boundary as the feed.
// A listing is visible if it's still active, OR this retailer already has a
// thread on it (e.g. their deal was accepted and the listing closed — they
// still need to reach their own deal/fulfillment page).
export async function getListingAnonymized(listingId: string, retailerId: string) {
  await expireStaleListings();
  return prisma.listing.findFirst({
    where: {
      id: listingId,
      OR: [{ status: "active" }, { threads: { some: { retailerId } } }],
    },
    select: {
      id: true,
      strainName: true,
      category: true,
      thcPercent: true,
      quantity: true,
      unit: true,
      pricePerUnit: true,
      terms: true,
      notes: true,
      status: true,
      expiresAt: true,
      media: true,
      postedBy: { select: { anonHandle: true } },
    },
  });
}

export { generateAnonHandle };
