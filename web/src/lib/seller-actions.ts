import "server-only";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { createListing } from "@/lib/listings";
import { addOfferRound, type RoundAction } from "@/lib/offers";
import { uploadInvoice } from "@/lib/shipments";
import { CATEGORIES, LICENSED_ROLES, TERMS, type SellerRole } from "@/lib/constants";

// Shared by /grower, /processor, /broker "post a listing" actions — the
// three SELLER_ROLES. Keeping this in one place means the license gate and
// field parsing can't drift between the three near-identical portals.
export async function handleCreateListing(role: SellerRole, formData: FormData) {
  const session = await requireRole(role);

  if (LICENSED_ROLES.includes(role as (typeof LICENSED_ROLES)[number])) {
    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (user?.licenseVerification !== "approved") {
      redirect(`/${role}/listings/new?error=${encodeURIComponent(
        "Your license must be approved by an admin before you can post listings."
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

  await addOfferRound({
    threadId,
    actorId: session.user.id,
    actorRole: "seller",
    action,
    price: priceRaw ? Number(priceRaw) : undefined,
    terms: (termsRaw || undefined) as never,
    message: message || undefined,
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
