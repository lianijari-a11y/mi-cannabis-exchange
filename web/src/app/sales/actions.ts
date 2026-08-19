"use server";

import { requireRole } from "@/lib/dal";
import { resetUserPassword } from "@/lib/account-management";

export type ResetPasswordActionResult = { ok: true } | { ok: false; error: string };

// An Account Executive's side of "no self-serve forgot-password flow" — see
// lib/account-management.ts's resetUserPassword. Scoped there to growers
// and processors only, the same two roles an AE already has a standing
// relationship with everywhere else (searchAssistableSellers,
// handleCreateListingAsAssistant).
export async function resetSellerPasswordAction(
  userId: string,
  newPassword: string
): Promise<ResetPasswordActionResult> {
  await requireRole("sales_rep");
  try {
    await resetUserPassword("sales_rep", userId, newPassword);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't reset password." };
  }
}
