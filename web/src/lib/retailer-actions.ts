import "server-only";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getOrCreateThread, addOfferRound, type RoundAction } from "@/lib/offers";
import { acceptInvoiceAndAssignTransporter } from "@/lib/shipments";
import { toggleWatchlist } from "@/lib/watchlist";
import { acceptProduct, rejectProduct } from "@/lib/commission";

export async function handleRetailerRespond(formData: FormData) {
  const session = await requireRole("retailer");

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (user?.licenseVerification !== "approved") {
    const listingId = String(formData.get("listingId") ?? "");
    redirect(
      `/retailer/listings/${listingId}?error=${encodeURIComponent(
        "Your license must be approved by an admin before you can make offers."
      )}`
    );
  }

  const listingId = String(formData.get("listingId") ?? "");
  const action = String(formData.get("action") ?? "") as RoundAction;
  const priceRaw = String(formData.get("price") ?? "").trim();
  const termsRaw = String(formData.get("terms") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  let thread;
  try {
    thread = await getOrCreateThread(listingId, session.user.id);
  } catch {
    redirect(
      `/retailer/listings/${listingId}?error=${encodeURIComponent(
        "This listing is no longer active."
      )}`
    );
  }

  await addOfferRound({
    threadId: thread.id,
    actorId: session.user.id,
    actorRole: "retailer",
    action,
    price: priceRaw ? Number(priceRaw) : undefined,
    terms: (termsRaw || undefined) as never,
    message: message || undefined,
  });

  redirect(`/retailer/listings/${listingId}`);
}

// Retailer accepts the grower/processor's uploaded invoice and picks a
// transporter — this is what actually creates the Shipment.
export async function handleAcceptInvoice(formData: FormData) {
  const session = await requireRole("retailer");

  const listingId = String(formData.get("listingId") ?? "");
  const dealId = String(formData.get("dealId") ?? "");
  const transporterId = String(formData.get("transporterId") ?? "");

  if (!transporterId) {
    redirect(
      `/retailer/listings/${listingId}?error=${encodeURIComponent("Choose a transporter first.")}`
    );
  }

  await acceptInvoiceAndAssignTransporter(dealId, session.user.id, transporterId);
  redirect(`/retailer/listings/${listingId}`);
}

export async function handleAcceptProduct(formData: FormData) {
  const session = await requireRole("retailer");
  const dealId = String(formData.get("dealId") ?? "");
  const listingId = String(formData.get("listingId") ?? "");
  await acceptProduct(dealId, session.user.id);
  redirect(`/retailer/listings/${listingId}`);
}

export async function handleRejectProduct(formData: FormData) {
  const session = await requireRole("retailer");
  const dealId = String(formData.get("dealId") ?? "");
  const listingId = String(formData.get("listingId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  await rejectProduct(dealId, session.user.id, reason || null);
  redirect(`/retailer/listings/${listingId}`);
}

export async function handleToggleWatchlist(listingId: string) {
  const session = await requireRole("retailer");
  const nowWatching = await toggleWatchlist(session.user.id, listingId);
  revalidatePath("/retailer");
  revalidatePath(`/retailer/listings/${listingId}`);
  revalidatePath("/retailer/watchlist");
  return nowWatching;
}
