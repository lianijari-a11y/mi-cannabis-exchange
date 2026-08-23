import "server-only";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getOrCreateThread, addOfferRound, type RoundAction } from "@/lib/offers";
import { acceptInvoiceAndAssignTransporter, acceptShipmentSchedule, setDeliveryInstructions } from "@/lib/shipments";
import { toggleWatchlist } from "@/lib/watchlist";
import { toggleDismissal } from "@/lib/dismissals";
import { acceptProduct, rejectProduct, chooseReturn, proposeRejectionCounter } from "@/lib/commission";
import { createOrUpdateMandate, deactivateMandate, runAiNegotiationStep } from "@/lib/ai-negotiation";

export async function handleRetailerRespond(formData: FormData) {
  const session = await requireRole("retailer");

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  // Pending review ("unverified") can still make offers — only a rejected
  // license blocks it. See CLAUDE.md §12.
  if (user?.licenseVerification === "rejected") {
    const listingId = String(formData.get("listingId") ?? "");
    redirect(
      `/retailer/listings/${listingId}?error=${encodeURIComponent(
        "Your license was rejected by an admin. Contact support to resolve this before making offers."
      )}`
    );
  }

  const listingId = String(formData.get("listingId") ?? "");
  const action = String(formData.get("action") ?? "") as RoundAction;
  const priceRaw = String(formData.get("price") ?? "").trim();
  const termsRaw = String(formData.get("terms") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  const rejectionFeeRateRaw = String(formData.get("rejectionFeeRate") ?? "").trim();
  const rejectionFeePayerRaw = String(formData.get("rejectionFeePayer") ?? "").trim();
  const transportPayerPreferenceRaw = String(formData.get("transportPayerPreference") ?? "").trim();
  const expiresInRaw = String(formData.get("threadExpiresInHours") ?? "").trim();
  const expiresInHours = expiresInRaw ? Number(expiresInRaw) : null;

  let thread;
  try {
    thread = await getOrCreateThread(
      listingId,
      session.user.id,
      expiresInHours && Number.isFinite(expiresInHours)
        ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000)
        : null
    );
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
    rejectionFeeRate: rejectionFeeRateRaw ? Number(rejectionFeeRateRaw) : undefined,
    rejectionFeePayer: (rejectionFeePayerRaw || undefined) as never,
    transportPayerPreference: (transportPayerPreferenceRaw || undefined) as never,
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
  if (!reason) {
    redirect(
      `/retailer/listings/${listingId}?error=${encodeURIComponent("A reason is required to reject delivery.")}`
    );
  }
  await rejectProduct(dealId, session.user.id, reason);
  redirect(`/retailer/listings/${listingId}`);
}

// Retailer's two resolution paths once a rejection is on file — see
// CLAUDE.md §13 and lib/commission.ts's chooseReturn/proposeRejectionCounter.
export async function handleChooseReturn(formData: FormData) {
  const session = await requireRole("retailer");
  const dealId = String(formData.get("dealId") ?? "");
  const listingId = String(formData.get("listingId") ?? "");
  await chooseReturn(dealId, session.user.id);
  redirect(`/retailer/listings/${listingId}`);
}

export async function handleProposeRejectionCounter(formData: FormData) {
  const session = await requireRole("retailer");
  const dealId = String(formData.get("dealId") ?? "");
  const listingId = String(formData.get("listingId") ?? "");
  const counterPrice = Number(formData.get("counterPrice"));
  const counterNote = String(formData.get("counterNote") ?? "").trim();
  if (!Number.isFinite(counterPrice) || counterPrice <= 0) {
    redirect(
      `/retailer/listings/${listingId}?error=${encodeURIComponent("Enter a valid revised price.")}`
    );
  }
  await proposeRejectionCounter(dealId, session.user.id, counterPrice, counterNote || null);
  redirect(`/retailer/listings/${listingId}`);
}

// Transporter proposes a pickup/delivery window; grower and retailer each
// have to accept it separately (see lib/shipments.ts's acceptShipmentSchedule).
export async function handleAcceptShipmentSchedule(formData: FormData) {
  const session = await requireRole("retailer");
  const shipmentId = String(formData.get("shipmentId") ?? "");
  const listingId = String(formData.get("listingId") ?? "");
  await acceptShipmentSchedule(shipmentId, session.user.id, "retailer");
  redirect(`/retailer/listings/${listingId}`);
}

// Retailer sets standing delivery instructions for the transporter — gate
// code, dock/entrance, hours, who to ask for. See lib/shipments.ts's
// setDeliveryInstructions.
export async function handleSetDeliveryInstructions(formData: FormData) {
  const session = await requireRole("retailer");
  const shipmentId = String(formData.get("shipmentId") ?? "");
  const listingId = String(formData.get("listingId") ?? "");
  const instructions = String(formData.get("instructions") ?? "");
  await setDeliveryInstructions(shipmentId, session.user.id, instructions);
  redirect(`/retailer/listings/${listingId}`);
}

// Opt into (or update) AI-assisted negotiation on one open thread — the
// retailer gives AI a real price range and, from here on, it submits real
// counter-offers on their behalf in response to the seller's moves. See
// lib/ai-negotiation.ts's own extensive comment for the safety rails.
export async function handleOptIntoAiNegotiation(formData: FormData) {
  const session = await requireRole("retailer");
  const threadId = String(formData.get("threadId") ?? "");
  const listingId = String(formData.get("listingId") ?? "");
  const openingPrice = Number(formData.get("openingPrice"));
  const walkAwayPrice = Number(formData.get("walkAwayPrice"));

  const result = await createOrUpdateMandate({
    threadId,
    partyRole: "retailer",
    partyId: session.user.id,
    openingPrice,
    walkAwayPrice,
  });
  if (!result.ok) {
    redirect(`/retailer/listings/${listingId}?error=${encodeURIComponent(result.error)}`);
  }
  redirect(`/retailer/listings/${listingId}`);
}

// "Take back control" — stops AI from submitting any further rounds on this
// party's behalf. Does not undo rounds already submitted.
export async function handleTakeBackAiControl(formData: FormData) {
  const session = await requireRole("retailer");
  const threadId = String(formData.get("threadId") ?? "");
  const listingId = String(formData.get("listingId") ?? "");
  await deactivateMandate(threadId, "retailer", session.user.id);
  redirect(`/retailer/listings/${listingId}`);
}

// Called by the thread page's live-refresh poll (mirrors
// components/retailer/pos/live-refresh.tsx) while a negotiation with an
// active AI mandate is open — gives an AI-vs-AI thread a chance to keep
// advancing even though neither side has a human clicking a button.
// Deliberately re-checks that the caller is actually this thread's own
// retailer before running anything, rather than trusting an arbitrary
// threadId from the client.
export async function handlePollAiNegotiation(threadId: string) {
  const session = await requireRole("retailer");
  const thread = await prisma.offerThread.findUnique({ where: { id: threadId }, select: { retailerId: true } });
  if (!thread || thread.retailerId !== session.user.id) return;
  await runAiNegotiationStep(threadId);
}

export async function handleToggleWatchlist(listingId: string) {
  const session = await requireRole("retailer");
  const nowWatching = await toggleWatchlist(session.user.id, listingId);
  revalidatePath("/retailer");
  revalidatePath(`/retailer/listings/${listingId}`);
  revalidatePath("/retailer/watchlist");
  return nowWatching;
}

// "Not interested" — hides a listing from this retailer's own feed only.
export async function handleToggleDismissal(listingId: string) {
  const session = await requireRole("retailer");
  const nowDismissed = await toggleDismissal(session.user.id, listingId);
  revalidatePath("/retailer");
  return nowDismissed;
}
