"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { submitCartOrder, type CartItemInput, type SubmitCartOrderResult } from "@/lib/cart-orders";
import type { Terms } from "@/lib/constants";

// The write side of the public cart-building pages (/menu/[batchId] and
// /collection/[id], CLAUDE.md §40) — same "authorization checked inside
// the function, never trusted from the client" posture as
// respondToListingAsRetailer (§36), since retailerId always comes from the
// verified session here, never a client-supplied value.
//
// `assistedRetailerId` is the cart-page counterpart to §36/§49-C's
// admin/AE-assisted single-listing respond flow — "so can account
// executives and admin" was the explicit ask that extended bulk cart
// submission to them too, not just a normal retailer session. Only ever
// set by CartBuilder once an Admin/AE has resolved (found-or-created) the
// retailer they're acting for via RetailerPicker; never trusted as a bare
// client-supplied id without the role check below.
export async function submitPublicCartOrder(
  collectionId: string | undefined,
  items: CartItemInput[],
  terms: Terms,
  assistedRetailerId?: string
): Promise<SubmitCartOrderResult> {
  const session = await auth();

  if (assistedRetailerId) {
    const isAssistant = session?.user?.role === "admin" || session?.user?.role === "sales_rep";
    if (!isAssistant) return { ok: false, error: "Not authorized." };
    const retailer = await prisma.user.findUnique({ where: { id: assistedRetailerId } });
    if (!retailer || retailer.role !== "retailer") {
      return { ok: false, error: "Not a valid retailer account." };
    }
    return submitCartOrder(assistedRetailerId, items, terms, {
      collectionId,
      // CartOrder.facilitatedBySalesRepId/disclaimerAcknowledgedAt (schema
      // comment: "A Sales Rep facilitating this cart order") only apply to
      // an Account Executive — the liability disclaimer exists because an
      // AE has an ongoing relationship with the seller and connected the
      // parties, which isn't the reasoning behind Admin's broader,
      // no-disclaimer assisted authority elsewhere in this app (§36 never
      // required one either). CartBuilder only lets a sales_rep reach
      // submit after the disclaimer checkbox is checked client-side —
      // same "client-side gate, not a database acceptance record" posture
      // §41 already used for menu-collection creation.
      facilitatedBySalesRepId: session!.user!.role === "sales_rep" ? session!.user!.id : undefined,
      disclaimerAcknowledged: session!.user!.role === "sales_rep" ? true : undefined,
    });
  }

  if (!session?.user || session.user.role !== "retailer") {
    return { ok: false, error: "Not authorized." };
  }
  return submitCartOrder(session.user.id, items, terms, { collectionId });
}
