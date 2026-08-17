import "server-only";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { createListing, confirmListingFresh } from "@/lib/listings";
import { addOfferRound, type RoundAction } from "@/lib/offers";
import { uploadInvoice, acceptShipmentSchedule, setPickupInstructions } from "@/lib/shipments";
import { respondToSplitContract } from "@/lib/split-contracts";
import { acceptRejectionCounter, requireReturnInsteadOfCounter } from "@/lib/commission";
import { CATEGORIES, LICENSED_ROLES, TERMS, type SellerRole } from "@/lib/constants";

// Shared by /grower, /processor, /broker "post a listing" actions — the
// three SELLER_ROLES. Keeping this in one place means the license gate and
// field parsing can't drift between the three near-identical portals.
export async function handleCreateListing(role: SellerRole, formData: FormData) {
  const session = await requireRole(role);

  if (LICENSED_ROLES.includes(role as (typeof LICENSED_ROLES)[number])) {
    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    // Pending review ("unverified") is allowed through — only a rejected
    // license blocks posting. See CLAUDE.md §12: sellers post multiple times
    // a day and shouldn't be stuck waiting on Admin for a license that's
    // usually a clean match anyway.
    if (user?.licenseVerification === "rejected") {
      redirect(`/${role}/listings/new?error=${encodeURIComponent(
        "Your license was rejected by an admin. Contact support to resolve this before posting."
      )}`);
    }
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
    redirect(`/${role}/listings/new?error=${encodeURIComponent("Fill in the required fields.")}`);
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    redirect(`/${role}/listings/new?error=${encodeURIComponent("Quantity must be a positive number.")}`);
  }
  if (!Number.isFinite(pricePerUnit) || pricePerUnit <= 0) {
    redirect(`/${role}/listings/new?error=${encodeURIComponent("Price must be a positive number.")}`);
  }
  if (!TERMS.includes(terms as (typeof TERMS)[number])) {
    redirect(`/${role}/listings/new?error=${encodeURIComponent("Choose valid terms.")}`);
  }

  const files = formData.getAll("media").filter((f): f is File => f instanceof File);

  await createListing(
    session.user.id,
    role,
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
    files
  );

  redirect(`/${role}`);
}

// Shared by every seller-side "respond to an offer" action.
export async function handleSellerRespond(role: SellerRole, formData: FormData) {
  const session = await requireRole(role);

  const threadId = String(formData.get("threadId") ?? "");
  const action = String(formData.get("action") ?? "") as RoundAction;
  const priceRaw = String(formData.get("price") ?? "").trim();
  const termsRaw = String(formData.get("terms") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  const rejectionFeeRateRaw = String(formData.get("rejectionFeeRate") ?? "").trim();
  const rejectionFeePayerRaw = String(formData.get("rejectionFeePayer") ?? "").trim();

  await addOfferRound({
    threadId,
    actorId: session.user.id,
    actorRole: "seller",
    action,
    price: priceRaw ? Number(priceRaw) : undefined,
    terms: (termsRaw || undefined) as never,
    message: message || undefined,
    rejectionFeeRate: rejectionFeeRateRaw ? Number(rejectionFeeRateRaw) : undefined,
    rejectionFeePayer: (rejectionFeePayerRaw || undefined) as never,
  });

  redirect(`/${role}/listings/${formData.get("listingId")}`);
}

// Grower/processor uploads an invoice against their own accepted deal —
// what the retailer reviews before picking a transporter (see lib/shipments.ts).
export async function handleUploadInvoice(role: SellerRole, formData: FormData) {
  const session = await requireRole(role);

  const dealId = String(formData.get("dealId") ?? "");
  const listingId = String(formData.get("listingId") ?? "");
  const file = formData.get("invoice");

  if (!(file instanceof File) || file.size === 0) {
    redirect(`/${role}/listings/${listingId}?error=${encodeURIComponent("Choose an invoice file first.")}`);
  }

  await uploadInvoice(dealId, session.user.id, file);
  redirect(`/${role}/listings/${listingId}`);
}

// Grower accepts/rejects a processor's toll-processing (split-contract)
// proposal on one of their listings.
export async function handleSplitContractRespond(role: SellerRole, formData: FormData) {
  const session = await requireRole(role);

  const contractId = String(formData.get("contractId") ?? "");
  const listingId = String(formData.get("listingId") ?? "");
  const decision = String(formData.get("decision") ?? "") as "accepted" | "rejected";

  await respondToSplitContract(contractId, session.user.id, decision);
  redirect(`/${role}/listings/${listingId}`);
}

// One-click "still available" confirmation from the seller's own listing
// list — see lib/listings.ts's confirmListingFresh and CLAUDE.md §13.
export async function handleConfirmListingFresh(role: SellerRole, formData: FormData) {
  const session = await requireRole(role);
  const listingId = String(formData.get("listingId") ?? "");
  await confirmListingFresh(listingId, session.user.id);
  redirect(`/${role}`);
}

// Seller accepts the transporter's proposed pickup/delivery schedule.
export async function handleAcceptShipmentSchedule(role: SellerRole, formData: FormData) {
  const session = await requireRole(role);
  const shipmentId = String(formData.get("shipmentId") ?? "");
  const listingId = String(formData.get("listingId") ?? "");
  await acceptShipmentSchedule(shipmentId, session.user.id, "grower");
  redirect(`/${role}/listings/${listingId}`);
}

// Seller (Grower/Processor) sets standing pickup instructions for the
// transporter — gate code, dock/entrance, hours, who to ask for. See
// lib/shipments.ts's setPickupInstructions.
export async function handleSetPickupInstructions(role: SellerRole, formData: FormData) {
  const session = await requireRole(role);
  const shipmentId = String(formData.get("shipmentId") ?? "");
  const listingId = String(formData.get("listingId") ?? "");
  const instructions = String(formData.get("instructions") ?? "");
  await setPickupInstructions(shipmentId, session.user.id, instructions);
  redirect(`/${role}/listings/${listingId}`);
}

// Seller's two responses to a retailer's post-rejection counter-offer — see
// lib/commission.ts and CLAUDE.md §13.
export async function handleAcceptRejectionCounter(role: SellerRole, formData: FormData) {
  const session = await requireRole(role);
  const dealId = String(formData.get("dealId") ?? "");
  const listingId = String(formData.get("listingId") ?? "");
  await acceptRejectionCounter(dealId, session.user.id);
  redirect(`/${role}/listings/${listingId}`);
}

export async function handleRequireReturnInsteadOfCounter(role: SellerRole, formData: FormData) {
  const session = await requireRole(role);
  const dealId = String(formData.get("dealId") ?? "");
  const listingId = String(formData.get("listingId") ?? "");
  await requireReturnInsteadOfCounter(dealId, session.user.id);
  redirect(`/${role}/listings/${listingId}`);
}
