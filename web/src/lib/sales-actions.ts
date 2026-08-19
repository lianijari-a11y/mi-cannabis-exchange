import "server-only";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { createListing, updateListing, getListingForEdit } from "@/lib/listings";
import { markLeadAssignedRep } from "@/lib/leads";
import { CATEGORIES, UNITS, TERMS, SALES_REP_ASSISTABLE_ROLES } from "@/lib/constants";
import type { ListingDraft } from "@/lib/ai-listing";

// Search Growers/Processors by business name or email — used by both the
// Sales Rep portal and Admin's "post on behalf of a seller" page (added
// 2026-08-16, see CLAUDE.md §13). Real identity is the whole point here
// (someone has to pick the actual account to post for), so this is only
// ever called from sales_rep/admin-gated pages, never anywhere near the
// retailer-facing anonymization boundary.
//
// `actorRole`/`actorId` scope results for a Sales Rep to sellers they can
// actually work with — see CLAUDE.md §38's exclusive-assignment rule: once
// any rep works with a grower/processor, that account is locked to them, so
// a DIFFERENT rep's search shouldn't even surface it as a pickable option.
// Admin's own search (actorRole "admin") is unrestricted, matching Admin's
// unrestricted reach everywhere else this lock applies.
export async function searchAssistableSellers(
  query: string,
  actorRole?: "sales_rep" | "admin",
  actorId?: string
) {
  const q = query.trim();
  if (!q) return [];
  return prisma.user.findMany({
    where: {
      role: { in: [...SALES_REP_ASSISTABLE_ROLES] },
      AND: [
        { OR: [{ businessName: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] },
        ...(actorRole === "sales_rep"
          ? [{ OR: [{ assignedSalesRepId: null }, { assignedSalesRepId: actorId }] }]
          : []),
      ],
    },
    select: {
      id: true,
      businessName: true,
      fullName: true,
      email: true,
      role: true,
      licenseVerification: true,
      assignedSalesRepId: true,
    },
    take: 10,
    orderBy: { businessName: "asc" },
  });
}

// The exclusive-assignment gate (CLAUDE.md §38): once any Sales Rep first
// works with a Grower/Processor, that seller is locked to them — no other
// rep can post/edit for them after that. Admin is intentionally exempt
// (same unrestricted-reach posture as bypassOwnership everywhere else).
// Claims silently on first contact rather than requiring a separate "claim
// this account" step, since the natural first action (posting a listing,
// or creating the account in the first place) already IS the moment a rep
// starts working with someone.
async function claimOrVerifySellerAssignment(
  seller: { id: string; businessName: string | null; assignedSalesRepId: string | null },
  actorRole: "sales_rep" | "admin",
  actorId: string,
  actorName: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (actorRole === "admin") return { ok: true };
  if (!seller.assignedSalesRepId) {
    await prisma.user.update({ where: { id: seller.id }, data: { assignedSalesRepId: actorId } });
    await markLeadAssignedRep(seller.businessName, actorName).catch(() => {});
    return { ok: true };
  }
  if (seller.assignedSalesRepId !== actorId) {
    return { ok: false, error: "This grower/processor is already working with another Account Executive." };
  }
  return { ok: true };
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
  const assignment = await claimOrVerifySellerAssignment(seller, actorRole, session.user.id, session.user.name ?? "");
  if (!assignment.ok) {
    redirect(`${redirectBasePath}/listings/new?error=${encodeURIComponent(assignment.error)}`);
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
  const assignment = await claimOrVerifySellerAssignment(seller, actorRole, session.user.id, session.user.name ?? "");
  if (!assignment.ok) {
    redirect(`${redirectBasePath}/listings/new?error=${encodeURIComponent(assignment.error)}`);
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

// Core edit logic shared by every AE/Admin edit surface — returns a result
// instead of redirecting so each caller can send the user back to wherever
// makes sense for that page (a listing-specific edit page vs. staying on
// the account page the listing lives under). A Sales Rep can edit any
// listing belonging to a seller currently assigned to them (checked in
// lib/listings.ts's updateListing, CLAUDE.md §38 — not just listings they
// personally created); Admin can edit ANY listing platform-wide
// (bypassOwnership: true), matching Admin's existing unrestricted reach
// elsewhere (e.g. updateListingVisibility).
async function applyListingEditAsAssistant(
  actorRole: "sales_rep" | "admin",
  actorId: string,
  formData: FormData
): Promise<{ ok: true } | { ok: false; error: string }> {
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
    return { ok: false, error: "Fill in the required fields." };
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { ok: false, error: "Quantity must be a positive number." };
  }
  if (!Number.isFinite(pricePerUnit) || pricePerUnit <= 0) {
    return { ok: false, error: "Price must be a positive number." };
  }
  if (!TERMS.includes(terms as (typeof TERMS)[number])) {
    return { ok: false, error: "Choose valid terms." };
  }

  const files = formData.getAll("media").filter((f): f is File => f instanceof File);
  const removedMediaIds = formData.getAll("removeMedia").map(String);

  try {
    await updateListing(
      listingId,
      actorId,
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
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't update listing." };
  }
  return { ok: true };
}

// redirectBasePath is the page's own listings-detail base, e.g.
// "/sales/listings" or "/admin/listings" — used by the dedicated
// single-listing edit pages.
export async function handleEditListingAsAssistant(
  actorRole: "sales_rep" | "admin",
  redirectBasePath: string,
  formData: FormData
) {
  const session = await requireRole(actorRole);
  const listingId = String(formData.get("listingId") ?? "");
  const result = await applyListingEditAsAssistant(actorRole, session.user.id, formData);
  if (!result.ok) {
    redirect(`${redirectBasePath}/${listingId}?error=${encodeURIComponent(result.error)}`);
  }
  redirect(`${redirectBasePath}/${listingId}`);
}

// Same edit logic, but for a listing edited inline from its seller's
// Account page (CLAUDE.md §38) — redirects back to that account page
// instead of a listing-specific one, since that's where the user actually
// is. AE-only for now; Admin doesn't have an Accounts page yet.
export async function handleEditListingFromAccount(sellerId: string, formData: FormData) {
  const session = await requireRole("sales_rep");
  const result = await applyListingEditAsAssistant("sales_rep", session.user.id, formData);
  if (!result.ok) {
    redirect(`/sales/accounts/${sellerId}?error=${encodeURIComponent(result.error)}`);
  }
  redirect(`/sales/accounts/${sellerId}`);
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

// The AE's "Accounts" list (CLAUDE.md §38) — every grower/processor
// currently assigned to this rep, the account-centric view they actually
// work from day to day, distinct from listingsCreatedByAssistant's flat
// per-listing feed above.
export async function accountsForSalesRep(salesRepId: string) {
  return prisma.user.findMany({
    where: { assignedSalesRepId: salesRepId },
    select: {
      id: true,
      businessName: true,
      fullName: true,
      email: true,
      role: true,
      licenseVerification: true,
      _count: { select: { listings: true } },
    },
    orderBy: { businessName: "asc" },
  });
}

// One account's full profile + every listing they've ever posted (their
// whole menu, not just the ones this rep personally created) — the
// "click into a grower and see/edit their comprehensive menu" view.
// Scoped to accounts actually assigned to this rep; returns null otherwise
// (never leaks another rep's account through a guessed id).
export async function accountDetailForSalesRep(salesRepId: string, sellerId: string) {
  const seller = await prisma.user.findFirst({
    where: { id: sellerId, assignedSalesRepId: salesRepId },
    select: {
      id: true,
      businessName: true,
      fullName: true,
      email: true,
      phone: true,
      role: true,
      licenseNumber: true,
      licenseType: true,
      licenseVerification: true,
      licenseExpiry: true,
      address: true,
      city: true,
      state: true,
      zip: true,
      createdAt: true,
    },
  });
  if (!seller) return null;

  const listings = await prisma.listing.findMany({
    where: { postedById: sellerId },
    include: { media: true },
    orderBy: { createdAt: "desc" },
  });

  return { seller, listings };
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
