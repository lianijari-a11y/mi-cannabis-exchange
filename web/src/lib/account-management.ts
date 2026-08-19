import "server-only";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { SALES_REP_ASSISTABLE_ROLES } from "@/lib/constants";

// There's no self-serve "forgot password" flow anywhere in this app — no
// email-sending infra exists (same gap as SMS, see CLAUDE.md §28/§29), so a
// locked-out user calls their Account Executive or Admin, same way a real
// menu update or a new account gets built for them. Scoped by actor role:
// an Account Executive can only reset the two roles it already has a
// standing relationship with (SALES_REP_ASSISTABLE_ROLES — same scope as
// searchAssistableSellers/handleCreateListingAsAssistant); Admin can reset
// anyone's, matching Admin's existing platform-wide reach elsewhere (e.g.
// updateListing's bypassOwnership, updateListingVisibility).
export async function resetUserPassword(
  actorRole: "sales_rep" | "admin",
  targetUserId: string,
  newPassword: string
): Promise<void> {
  if (newPassword.length < 8) {
    throw new Error("New password must be at least 8 characters.");
  }
  const target = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!target) throw new Error("Account not found.");

  if (
    actorRole === "sales_rep" &&
    !SALES_REP_ASSISTABLE_ROLES.includes(target.role as (typeof SALES_REP_ASSISTABLE_ROLES)[number])
  ) {
    throw new Error("You can only reset a grower or processor's password.");
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  // Someone else chose this password on the account holder's behalf —
  // same signal createRetailerAccountForAdmin sets at creation, checked
  // by the license-first inline sign-in flow on a public menu/collection
  // link (components/cart/license-auth-flow.tsx) to prompt a retailer for
  // a real password instead of the one just reset for them.
  await prisma.user.update({
    where: { id: targetUserId },
    data: { passwordHash, mustChangePassword: true },
  });
}
