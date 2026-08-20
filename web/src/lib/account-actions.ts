"use server";

import { auth } from "@/auth";
import { changeOwnPassword } from "@/lib/account-management";

export type ChangePasswordState = { ok?: true; error?: string } | undefined;

// Shared by every role's settings page — the one self-service "change my
// own password" control that was completely missing before this. Reads
// the caller from the session directly rather than trusting a client-
// supplied userId, same posture as every other session-derived action in
// this app.
export async function changeOwnPasswordAction(
  _prevState: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
  const session = await auth();
  if (!session?.user) return { error: "Not signed in." };

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (newPassword !== confirmPassword) {
    return { error: "New passwords don't match." };
  }

  const result = await changeOwnPassword(session.user.id, currentPassword, newPassword);
  if (!result.ok) return { error: result.error };
  return { ok: true };
}
