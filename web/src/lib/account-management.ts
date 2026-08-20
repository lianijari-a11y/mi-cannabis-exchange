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
  // Someone else chose this password on the account holder's behalf — the
  // signal that forces a real change at next sign-in for EVERY role now
  // (lib/dal.ts's requireRole/requirePosAccess/requireAuth check this live
  // on every request, not just the retailer-only license-first cart flow
  // this flag originally existed for).
  await prisma.user.update({
    where: { id: targetUserId },
    data: { passwordHash, mustChangePassword: true },
  });
}

// Live per-request check — deliberately a DB read, not trusted from the
// JWT/session, so it reflects an Admin/AE resetting someone's password
// even if that person still has an existing, unexpired session open
// elsewhere (this app uses stateless JWT sessions with no server-side
// session store to actually revoke, so this is the one piece of "force a
// real re-auth after a reset" this app can do without a bigger session
// architecture change — see CLAUDE.md's own audit note on that tradeoff).
export async function userMustChangePassword(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { mustChangePassword: true } });
  return user?.mustChangePassword ?? false;
}

// The forced-change gate (/account/change-password) — no "current
// password" prompt, since the whole point is the account holder was
// handed a temporary one nobody expects them to type twice.
export async function setPasswordAfterForcedChange(userId: string, newPassword: string): Promise<void> {
  if (newPassword.length < 8) {
    throw new Error("New password must be at least 8 characters.");
  }
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, mustChangePassword: false },
  });
}

// Real self-service password change from a settings page — the one path
// that was completely missing before this: every other way a password
// changes in this app involves an Admin/AE or a forgot-password token.
// Requires the current password, same as any normal "change password"
// control elsewhere on the web.
export async function changeOwnPassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (newPassword.length < 8) {
    return { ok: false, error: "New password must be at least 8 characters." };
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { ok: false, error: "Account not found." };

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) return { ok: false, error: "Current password is incorrect." };

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, mustChangePassword: false },
  });
  return { ok: true };
}
