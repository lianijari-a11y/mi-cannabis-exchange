import "server-only";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { createListing, updateListing, getListingForEdit } from "@/lib/listings";
import { CATEGORIES, UNITS, TERMS, SALES_REP_ASSISTABLE_ROLES } from "@/lib/constants";
import type { ListingDraft } from "@/lib/ai-listing";

// Search Growers/Processors by business name or email — used by both the
// Sales Rep portal and Admin's "post on behalf of a seller" page (added
// 2026-08-16, see CLAUDE.md §13). Real identity is the whole point here
// (someone has to pick the actual account to post for), so this is only
// ever called from sales_rep/admin-gated pages, never anywhere near the
// retailer-facing anonymization boundary.
export async function searchAssistableSellers(query: string) {
  const q = query.trim();
  if (!q) return [];
  return prisma.user.findMany({
    where: {
      role: { in: [...SALES_REP_ASSISTABLE_ROLES] },
      OR: [
        { businessName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ],
    },
    select: { id: true, businessName: true, fullName: true, email: true, role: true, licenseVerification: true },
    take: 10,
    orderBy: { businessName: "asc" },
  });
}

// Shared by /sales/listings/new and /admin/listings/new — a Sales Rep or
// Admin builds a listing and posts it under the chosen seller's own
// identity (Listing.postedById), with createdBySalesRepId/createdByAdminId
// left as an audit trail via createdBySalesRepId on Listing. Mirrors
// handleCreateListing in lib/seller-actions.ts closely on purpose.
export async function handleCreateListingAsAssistant(
  actorRole: "sales_rep" | "admin",
  redirectBasePath: string,
  formData: FormData
) {
  const session = await requireRole(actorRole);

  const sellerId = String(formData.get("sellerId") ?? "");
  const seller = await prisma.user.findUnique({ where: { id: sellerId } });
  if (!seller || !SALES_REP_ASSISTABLE_ROLES.includes(seller.role as (typeof SALES_REP_ASSISTABLE_ROLES)[number])) {
    redirect(`${redirectBasePath}/listings/new?error=${encodeURIComponent("Choose a valid grower or processor to post for.")}`);
  }

  const strainName = String(formData.get("strainName") ?? "").trim();
  const category = String(formData.get("category") ?? "");
  const thcRaw = String(formData.get("thcPercent") ?? "").trim();
  const quantity = Number(formData.get("quantity"));
  const unit = String(formData.get("unit") ?? "");
  const pricePerUnit = Number(formData.get("pricePerUnit"));
  const terms = String(formData.get("terms") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();
  const expiresInRaw = String(formData.get("expiresInHours") ?? "").trim();
  const expiresInHours = expiresInRaw ? Number(expiresInRaw) : null;

  if (!strainName || !CATEGORIES.includes(category as (typeof CATEGORIES)[number])) {
    redirect(`${redirectBasePath}/listings/new?error=${encodeURIComponent("Fill in the required fields.")}`);
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    redirect(`${redirectBasePath}/listings/new?error=${encodeURIComponent("Quantity must be a positive number.")}`);
  }
  if (!Number.isFinite(pricePerUnit) || pricePerUnit <= 0) {
    redirect(`${redirectBasePath}/listings/new?error=${encodeURIComponent("Price must be a positive number.")}`);
  }
  if (!TERMS.includes(terms as (typeof TERMS)[number])) {
    redirect(`${redirectBasePath}/listings/new?error=${encodeURIComponent("Choose valid terms.")}`);
  }

  const files = formData.getAll("media").filter((f): f is File => f instanceof File);

  await createListing(
    seller.id,
    seller.role,
    {
      strainName,
      category: category as (typeof CATEGORIES)[number],
      thcPercent: thcRaw ? Number(thcRaw) : null,
      quantity,
      unit: unit as never,
      pricePerUnit,
      terms: terms as (typeof TERMS)[number],
      notes: notes || null,
      expiresAt:
        expiresInHours && Number.isFinite(expiresInHours)
          ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000)
          : null,
    },
    files,
    session.user.id
  );

  redirect(redirectBasePath);
}

// Same posting-under-the-seller's-own-identity model as
// handleCreateListingAsAssistant above, but for a whole batch of drafts at
// once — added after a real Account Executive pasted a 21-strain price list
// into the single-item AI structuring flow and it broke (see CLAUDE.md).
// Each row can carry its own photos/videos too — the client tags every draft
// row with a stable `_key` (see listing-form.tsx) and submits that row's
// files under a matching `media_<key>` field, since a plain array index
// would desync from the JSON `drafts` payload once a row is removed.
export async function handleCreateListingsAsAssistantBulk(
  actorRole: "sales_rep" | "admin",
  redirectBasePath: string,
  formData: FormData
) {
  const session = await requireRole(actorRole);

  const sellerId = String(formData.get("sellerId") ?? "");
  const seller = await prisma.user.findUnique({ where: { id: sellerId } });
  if (!seller || !SALES_REP_ASSISTABLE_ROLES.includes(seller.role as (typeof SALES_REP_ASSISTABLE_ROLES)[number])) {
    redirect(`${redirectBasePath}/listings/new?error=${encodeURIComponent("Choose a valid grower or processor to post for.")}`);
  }

  let drafts: (ListingDraft & { _key?: string })[];
  try {
    drafts = JSON.parse(String(formData.get("drafts") ?? "[]"));
  } catch {
    redirect(`${redirectBasePath}/listings/new?error=${encodeURIComponent("Something went wrong submitting the batch — try again.")}`);
  }
  if (!Array.isArray(drafts) || drafts.length === 0) {
    redirect(`${redirectBasePath}/listings/new?error=${encodeURIComponent("No listings to post.")}`);
  }

  const expiresInRaw = String(formData.get("expiresInHours") ?? "").trim();
  const expiresInHours = expiresInRaw ? Number(expiresInRaw) : null;
  const expiresAt =
    expiresInHours && Number.isFinite(expiresInHours)
      ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000)
      : null;

  // Every row was already editable/removable in the review table, so an
  // invalid row here means the client-side "Post all" guard was bypassed —
  // skip it rather than fail the whole batch over one bad row.
  let created = 0;
  for (const d of drafts) {
    const strainName = typeof d?.strainName === "string" ? d.strainName.trim() : "";
    const category = CATEGORIES.includes(d?.category) ? d.category : null;
    const unit = UNITS.includes(d?.unit) ? d.unit : null;
    const terms = TERMS.includes(d?.terms) ? d.terms : null;
    const quantity = Number(d?.quantity);
    const pricePerUnit = Number(d?.pricePerUnit);
    if (!strainName || !category || !unit || !terms) continue;
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    if (!Number.isFinite(pricePerUnit) || pricePerUnit <= 0) continue;

    const rowKey = typeof d?._key === "string" ? d._key : null;
    const files = rowKey
      ? formData.getAll(`media_${rowKey}`).filter((f): f is File => f instanceof File)
      : [];

    await createListing(
      seller.id,
      seller.role,
      {
        strainName,
        category,
        thcPercent: typeof d?.thcPercent === "number" ? d.thcPercent : null,
        quantity,
        unit,
        pricePerUnit,
        terms,
        notes: typeof d?.notes === "string" && d.notes.trim() ? d.notes.trim() : null,
        expiresAt,
      },
      files,
      session.user.id
    );
    created++;
  }

  if (created === 0) {
    redirect(`${redirectBasePath}/listings/new?error=${encodeURIComponent("None of those rows had valid required fields — nothing was posted.")}`);
  }

  redirect(redirectBasePath);
}

// The AE/Admin side of "edit the menu as it sells" — a Sales Rep can edit
// any listing they personally built (createdBySalesRepId match, checked in
// lib/listings.ts's updateListing); Admin can edit ANY listing platform-wide
// (bypassOwnership: true), matching Admin's existing unrestricted reach
// elsewhere (e.g. updateListingVisibility). redirectBasePath is the page's
// own listings-detail base, e.g. "/sales/listings" or "/admin/listings".
export async function handleEditListingAsAssistant(
  actorRole: "sales_rep" | "admin",
  redirectBasePath: string,
  formData: FormData
) {
  const session = await requireRole(actorRole);
  const listingId = String(formData.get("listingId") ?? "");

  const strainName = String(formData.get("strainName") ?? "").trim();
  const category = String(formData.get("category") ?? "");
  const thcRaw = String(formData.get("thcPercent") ?? "").trim();
  const quantity = Number(formData.get("quantity"));
  const unit = String(formData.get("unit") ?? "");
  const pricePerUnit = Number(formData.get("pricePerUnit"));
  const terms = String(formData.get("terms") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();

  if (!strainName || !CATEGORIES.includes(category as (typeof CATEGORIES)[number])) {
    redirect(`${redirectBasePath}/${listingId}?error=${encodeURIComponent("Fill in the required fields.")}`);
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    redirect(`${redirectBasePath}/${listingId}?error=${encodeURIComponent("Quantity must be a positive number.")}`);
  }
  if (!Number.isFinite(pricePerUnit) || pricePerUnit <= 0) {
    redirect(`${redirectBasePath}/${listingId}?error=${encodeURIComponent("Price must be a positive number.")}`);
  }
  if (!TERMS.includes(terms as (typeof TERMS)[number])) {
    redirect(`${redirectBasePath}/${listingId}?error=${encodeURIComponent("Choose valid terms.")}`);
  }

  const files = formData.getAll("media").filter((f): f is File => f instanceof File);
  const removedMediaIds = formData.getAll("removeMedia").map(String);

  try {
    await updateListing(
      listingId,
      session.user.id,
      {
        strainName,
        category: category as (typeof CATEGORIES)[number],
        thcPercent: thcRaw ? Number(thcRaw) : null,
        quantity,
        unit: unit as never,
        pricePerUnit,
        terms: terms as (typeof TERMS)[number],
        notes: notes || null,
      },
      files,
      removedMediaIds,
      { bypassOwnership: actorRole === "admin" }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Couldn't update listing.";
    redirect(`${redirectBasePath}/${listingId}?error=${encodeURIComponent(message)}`);
  }

  redirect(`${redirectBasePath}/${listingId}`);
}

// AE/Admin's own read of a listing to edit — same authorization as
// handleEditListingAsAssistant above.
export async function getListingForAssistantEdit(
  actorRole: "sales_rep" | "admin",
  listingId: string
) {
  const session = await requireRole(actorRole);
  return getListingForEdit(listingId, session.user.id, { bypassOwnership: actorRole === "admin" });
}

// Listings a Sales Rep (or Admin, via the same page) has personally built —
// their own "recent activity" view. Real seller identity shown, same trust
// tier as Broker (CLAUDE.md §13).
export async function listingsCreatedByAssistant(assistantId: string) {
  return prisma.listing.findMany({
    where: { createdBySalesRepId: assistantId },
    include: { postedBy: { select: { businessName: true, fullName: true, role: true } } },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
}

// Deals closed from a Sales Rep's own listings, with their commission
// status — see CLAUDE.md §18. A "sale" here means the underlying OfferThread
// reached "accepted" (a Deal exists); the commission amount is only filled
// in once the retailer accepts the delivered product (lib/commission.ts's
// acceptProduct), same trigger as Broker commission.
export async function salesForRep(salesRepId: string) {
  return prisma.deal.findMany({
    where: { thread: { listing: { createdBySalesRepId: salesRepId } } },
    include: {
      thread: { include: { listing: { select: { strainName: true, category: true } } } },
      salesRepCommission: true,
    },
    orderBy: { createdAt: "desc" },
  });
}
