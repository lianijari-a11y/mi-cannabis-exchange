"use server";

import { unsubscribeLead } from "@/lib/lead-email";

// Public, unauthenticated — anyone can hit this with a leadId/token pair,
// but unsubscribeLead itself verifies the token before doing anything, so
// a wrong/guessed token just gets rejected, same posture as every other
// genuinely public write surface in this app (the cart-checkout license
// flow, the storefront order action).
export async function confirmUnsubscribeAction(leadId: string, token: string) {
  return unsubscribeLead(leadId, token);
}
