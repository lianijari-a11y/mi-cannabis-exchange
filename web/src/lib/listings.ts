import "server-only";
import { prisma } from "@/lib/prisma";
import { generateAnonHandle } from "@/lib/anon-handle";
import { finalizeUploadedMedia } from "@/lib/media";
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
  media: { url: string; contentType: string }[],
  createdBySalesRepId?: string,
  batchId?: string
) {
  if (!SELLER_ROLES.includes(postedByRole as (typeof SELLER_ROLES)[number])) {
    throw new Error("Only growers, processors, and brokers can post listings.");
  }

  const listing = await prisma.listing.create({
    data: {
      postedById,
      createdBySalesRepId: createdBySalesRepId ?? null,
      // Every listing belongs to exactly one "menu" — a caller posting a
      // single strain just gets a menu of 1, since there's no meaningful
      // difference between that and a batch that happens to contain one
      // item. Callers creating several listings from one form submission
      // (bulk import) generate ONE batchId up front and pass it to every
      // createListing call in that loop instead of leaving this default.
      batchId: batchId ?? crypto.randomUUID(),
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

  for (const [i, { url, contentType }] of media.entries()) {
    if (!url) continue;
    const saved = await finalizeUploadedMedia(url, contentType);
    await prisma.listingMedia.create({
      data: {
        listingId: listing.id,
        url: saved.url,
        type: saved.type,
        sortOrder: i,
        redactionAttempted: saved.redactionAttempted,
        redactionRegionsFound: saved.redactionRegionsFound,
        redactionError: saved.redactionError ?? null,
      },
    });
  }

  return listing;
}

export type ListingEditInput = {
  strainName: string;
  category: Category;
  thcPercent: number | null;
  quantity: number;
  unit: Unit;
  pricePerUnit: number;
  terms: Terms;
  notes: string | null;
  minimumOrderQuantity: number | null;
  belowMinimumPricePerUnit: number | null;
};

// Growers/processors sell out of the same menu over days — price, quantity,
// and photos all need to change while the listing stays live, not just via
// a "still available" freshness bump. Authorized for the seller who posted
// it (postedById) OR the Sales Rep/Admin who built it on the seller's behalf
// (createdBySalesRepId) — the same two identities CLAUDE.md §13 already lets
// post a listing in the first place. `bypassOwnership` is only ever passed
// true from an Admin-gated caller (already requireRole("admin")'d) so any
// Admin can fix any listing, matching Admin's existing platform-wide reach
// elsewhere (e.g. updateListingVisibility has no ownership check either).
export async function updateListing(
  listingId: string,
  callerId: string,
  input: ListingEditInput,
  newMedia: { url: string; contentType: string }[],
  removedMediaIds: string[],
  opts?: { bypassOwnership?: boolean }
) {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: { postedBy: { select: { assignedSalesRepId: true } } },
  });
  if (!listing) throw new Error("Listing not found.");
  const authorized =
    opts?.bypassOwnership ||
    listing.postedById === callerId ||
    listing.createdBySalesRepId === callerId ||
    // The Sales Rep currently assigned to this listing's seller (CLAUDE.md
    // §38) can manage the seller's whole menu, not just listings they
    // personally created — an account is dedicated to one rep, not just
    // whatever that rep happened to post themselves.
    listing.postedBy.assignedSalesRepId === callerId;
  if (!authorized) throw new Error("Not authorized for this listing.");
  if (listing.status !== "active") {
    throw new Error("Only an active listing can be edited.");
  }

  if (removedMediaIds.length > 0) {
    await prisma.listingMedia.deleteMany({ where: { id: { in: removedMediaIds }, listingId } });
  }

  const remainingCount = await prisma.listingMedia.count({ where: { listingId } });
  for (const [i, { url, contentType }] of newMedia.entries()) {
    if (!url) continue;
    const saved = await finalizeUploadedMedia(url, contentType);
    await prisma.listingMedia.create({
      data: {
        listingId,
        url: saved.url,
        type: saved.type,
        sortOrder: remainingCount + i,
        redactionAttempted: saved.redactionAttempted,
        redactionRegionsFound: saved.redactionRegionsFound,
        redactionError: saved.redactionError ?? null,
      },
    });
  }

  await prisma.listing.update({
    where: { id: listingId },
    data: {
      strainName: input.strainName,
      category: input.category,
      thcPercent: input.thcPercent,
      quantity: input.quantity,
      unit: input.unit,
      pricePerUnit: input.pricePerUnit,
      terms: input.terms,
      notes: input.notes,
      minimumOrderQuantity: input.minimumOrderQuantity,
      belowMinimumPricePerUnit: input.belowMinimumPricePerUnit,
      // Same "any edit counts as a freshness signal" intent as
      // confirmListingFresh — see the comment on lastConfirmedAt in
      // schema.prisma.
      lastConfirmedAt: new Date(),
    },
  });
}

// Bulk photo upload for an already-posted menu — "what if I made a menu
// without pictures, I'd need a new way to upload pictures for menus that
// are already done" (raised, then built). One call per menu: each file is
// pre-assigned to a specific listingId (the UI resolves that, optionally
// via lib/ai-listing.ts's matchPhotosToMenu for a first-pass suggestion the
// seller/AE can still override) — this function just does the actual save,
// reusing the exact per-listing authorization rule updateListing already
// enforces. A file that fails its own listing's check is silently skipped
// rather than failing the whole batch, same "partial-but-explained beats
// all-or-nothing" posture as the bulk listing importer (CLAUDE.md §34).
export async function bulkAddMediaToMenu(
  batchId: string,
  callerId: string,
  assignments: { listingId: string; url: string; contentType: string }[],
  opts?: { bypassOwnership?: boolean }
): Promise<{ ok: true; savedCount: number } | { ok: false; error: string }> {
  if (assignments.length === 0) return { ok: false, error: "No photos to save." };

  const listingIds = [...new Set(assignments.map((a) => a.listingId))];
  const listings = await prisma.listing.findMany({
    where: { id: { in: listingIds }, batchId },
    include: { postedBy: { select: { assignedSalesRepId: true } } },
  });
  const listingById = new Map(listings.map((l) => [l.id, l]));

  let savedCount = 0;
  for (const { listingId, url, contentType } of assignments) {
    if (!url) continue;
    const listing = listingById.get(listingId);
    if (!listing || listing.status !== "active") continue;
    const authorized =
      opts?.bypassOwnership ||
      listing.postedById === callerId ||
      listing.createdBySalesRepId === callerId ||
      listing.postedBy.assignedSalesRepId === callerId;
    if (!authorized) continue;

    const remainingCount = await prisma.listingMedia.count({ where: { listingId } });
    const saved = await finalizeUploadedMedia(url, contentType);
    await prisma.listingMedia.create({
      data: {
        listingId,
        url: saved.url,
        type: saved.type,
        sortOrder: remainingCount,
        redactionAttempted: saved.redactionAttempted,
        redactionRegionsFound: saved.redactionRegionsFound,
        redactionError: saved.redactionError ?? null,
      },
    });
    await prisma.listing.update({ where: { id: listingId }, data: { lastConfirmedAt: new Date() } });
    savedCount++;
  }

  if (savedCount === 0) {
    return { ok: false, error: "None of those photos could be saved — check you're authorized for this menu." };
  }
  return { ok: true, savedCount };
}

// Broader read for the Sales Rep/Admin edit page — same authorization rule
// as updateListing above (postedById OR createdBySalesRepId, or bypass for
// Admin). getListingForSeller below stays strict to postedById only, since
// that's the seller's own dashboard.
export async function getListingForEdit(listingId: string, callerId: string, opts?: { bypassOwnership?: boolean }) {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: { media: true, postedBy: { select: { assignedSalesRepId: true } } },
  });
  if (!listing) return null;
  const authorized =
    opts?.bypassOwnership ||
    listing.postedById === callerId ||
    listing.createdBySalesRepId === callerId ||
    listing.postedBy.assignedSalesRepId === callerId;
  if (!authorized) return null;
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
// `excludeDismissedFor`: when given a retailerId, listings that retailer
// marked "Not interested" are left out — see lib/dismissals.ts. Purely a
// per-retailer view filter, never affects what anyone else sees.
export async function activeListingsFeed(excludeDismissedFor?: string) {
  await expireStaleListings();
  const dismissedIds = excludeDismissedFor
    ? await prisma.listingDismissal.findMany({
        where: { retailerId: excludeDismissedFor },
        select: { listingId: true },
      })
    : [];

  return prisma.listing.findMany({
    where: {
      status: "active",
      ...(dismissedIds.length ? { id: { notIn: dismissedIds.map((d) => d.listingId) } } : {}),
      // Distribution gate — see CLAUDE.md §18. Default "all" listings are
      // visible to every retailer, same as always; an admin-restricted
      // "exclusive" listing only shows to a retailer named on it.
      OR: [
        { visibility: "all" },
        ...(excludeDismissedFor
          ? [{ visibility: "exclusive", exclusiveRetailerIds: { has: excludeDismissedFor } }]
          : []),
      ],
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
      createdAt: true,
      expiresAt: true,
      lastConfirmedAt: true,
      media: true,
      postedBy: { select: { anonHandle: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

// One-click "still available" confirmation — bumps lastConfirmedAt so the
// seller's dashboard stops flagging it as stale, without having to re-enter
// or change anything about the listing. See CLAUDE.md §13.
export async function confirmListingFresh(listingId: string, sellerId: string) {
  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing || listing.postedById !== sellerId) {
    throw new Error("Not authorized for this listing.");
  }
  await prisma.listing.update({
    where: { id: listingId },
    data: { lastConfirmedAt: new Date() },
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
      // Distribution gate — same as activeListingsFeed. A retailer who
      // already has a thread on it can still reach it even if visibility
      // later changed, since the OR above already covers that case.
      AND: [
        {
          OR: [
            { visibility: "all" },
            { visibility: "exclusive", exclusiveRetailerIds: { has: retailerId } },
            { threads: { some: { retailerId } } },
          ],
        },
      ],
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

// Public, no-session listing view for shareable links (CLAUDE.md §36) — a
// deliberate, confirmed loosening of "you must already be a logged-in
// verified Retailer to see anything." Same anonymization select as
// getListingAnonymized above (never the real seller identity), but with two
// differences: no retailerId to scope against, and exclusive listings are
// excluded outright rather than gated — a public link bypassing
// Admin-restricted distribution would defeat the point of that feature, so
// `visibility: "all"` is a hard requirement here, not a fallback branch.
export async function publicListingView(listingId: string) {
  await expireStaleListings();
  return prisma.listing.findFirst({
    where: { id: listingId, status: "active", visibility: "all" },
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

// The whole-menu counterpart to publicListingView above (CLAUDE.md §40) —
// a shareable link for an entire bulk-uploaded batch, not just one strain.
// Same public-view rules apply per listing: only status "active" AND
// visibility "all" rows are included, so an Admin-restricted exclusive
// listing inside an otherwise-shareable batch is silently left out rather
// than exposed. Returns null (not an empty array) when NOTHING in the
// batch qualifies, so the caller can render a clean "not available"
// state instead of an empty menu page.
export async function publicMenuView(batchId: string) {
  await expireStaleListings();
  const listings = await prisma.listing.findMany({
    where: { batchId, status: "active", visibility: "all" },
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
      minimumOrderQuantity: true,
      belowMinimumPricePerUnit: true,
      postedBy: { select: { anonHandle: true } },
    },
    orderBy: { strainName: "asc" },
  });
  if (listings.length === 0) return null;
  return { batchId, postedByHandle: listings[0].postedBy.anonHandle, listings };
}

export { generateAnonHandle };
