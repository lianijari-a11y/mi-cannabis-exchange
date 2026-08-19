"use server";

import { auth } from "@/auth";
import { submitCartOrder, type CartItemInput, type SubmitCartOrderResult } from "@/lib/cart-orders";
import type { Terms } from "@/lib/constants";

// The write side of the public cart-building pages (/menu/[batchId] and
// /collection/[id], CLAUDE.md §40) — same "authorization checked inside
// the function, never trusted from the client" posture as
// respondToListingAsRetailer (§36), since retailerId always comes from the
// verified session here, never a client-supplied value.
export async function submitPublicCartOrder(
  collectionId: string | undefined,
  items: CartItemInput[],
  terms: Terms
): Promise<SubmitCartOrderResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "retailer") {
    return { ok: false, error: "Not authorized." };
  }
  return submitCartOrder(session.user.id, items, terms, { collectionId });
}
