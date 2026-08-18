"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateThread, addOfferRound, type RoundAction } from "@/lib/offers";

export type RespondResult = { ok: true; threadId: string } | { ok: false; error: string };

// The write side of a shared listing link (CLAUDE.md §36) — reused by both
// a real authenticated Retailer session (the self-serve path) and Admin
// acting on a retailer's behalf (the broker-assisted path), since the
// actual negotiation write is identical either way. Deliberately NOT
// gated by requireRole("retailer") the way lib/retailer-actions.ts's
// handleRetailerRespond is, since Admin needs to call this for someone
// else's retailerId — so authorization is checked explicitly here instead:
// either the caller IS that retailer, or the caller is Admin. Never trust
// the client's own UI-level gating for this, since retailerId is a plain
// argument a client component could otherwise pass arbitrarily.
export async function respondToListingAsRetailer(
  listingId: string,
  retailerId: string,
  action: RoundAction,
  params: { price?: number; terms?: string; message?: string }
): Promise<RespondResult> {
  const session = await auth();
  const isSelf = session?.user?.role === "retailer" && session.user.id === retailerId;
  const isAdmin = session?.user?.role === "admin";
  if (!isSelf && !isAdmin) {
    return { ok: false, error: "Not authorized." };
  }

  const user = await prisma.user.findUnique({ where: { id: retailerId } });
  if (!user || user.role !== "retailer") {
    return { ok: false, error: "Not a valid retailer account." };
  }
  // Same rule as the logged-in negotiation flow (CLAUDE.md §12) — only a
  // rejected license blocks acting, "unverified"/pending review does not.
  if (user.licenseVerification === "rejected") {
    return { ok: false, error: "This account's license was rejected by an admin." };
  }

  let thread;
  try {
    thread = await getOrCreateThread(listingId, retailerId);
  } catch {
    return { ok: false, error: "This listing is no longer active." };
  }

  await addOfferRound({
    threadId: thread.id,
    actorId: retailerId,
    actorRole: "retailer",
    action,
    price: params.price,
    terms: params.terms as never,
    message: params.message,
  });

  return { ok: true, threadId: thread.id };
}
