"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateThread, addOfferRound, type RoundAction } from "@/lib/offers";

export type RespondResult = { ok: true; threadId: string } | { ok: false; error: string };

// The write side of a shared listing link (CLAUDE.md §36) — reused by a
// real authenticated Retailer session (the self-serve path), Admin acting
// on a retailer's behalf (the broker-assisted path), and — added later,
// on direct request — an Account Executive doing the same. §36 originally
// kept this Admin-only on purpose ("their broker who is admin," no
// equivalent standing relationship between an AE and a retailer) — that
// was a real, confirmed reversal, not an oversight; recorded here rather
// than silently overwriting the original reasoning. The actual negotiation
// write is identical for all three callers. Deliberately NOT gated by
// requireRole("retailer") the way lib/retailer-actions.ts's
// handleRetailerRespond is, since Admin/AE need to call this for someone
// else's retailerId — so authorization is checked explicitly here instead:
// either the caller IS that retailer, or the caller is Admin/AE. Never
// trust the client's own UI-level gating for this, since retailerId is a
// plain argument a client component could otherwise pass arbitrarily.
export async function respondToListingAsRetailer(
  listingId: string,
  retailerId: string,
  action: RoundAction,
  params: { price?: number; terms?: string; message?: string }
): Promise<RespondResult> {
  const session = await auth();
  const isSelf = session?.user?.role === "retailer" && session.user.id === retailerId;
  const isAssistant = session?.user?.role === "admin" || session?.user?.role === "sales_rep";
  if (!isSelf && !isAssistant) {
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
