"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { completePasswordReset } from "@/lib/password-reset";
import { roleHome } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

export type ResetPasswordState = { error?: string } | undefined;

export async function resetPasswordAction(
  _prevState: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (password !== confirmPassword) {
    return { error: "Passwords don't match." };
  }

  const result = await completePasswordReset(token, password);
  if (!result.ok) return { error: result.error };

  const user = await prisma.user.findUnique({ where: { email: result.email }, select: { role: true } });

  try {
    // Matches signup/login's own pattern — signIn() throws its own
    // redirect signal via redirectTo, which isn't an AuthError, so it
    // isn't caught by the block below.
    await signIn("credentials", { email: result.email, password, redirectTo: roleHome(user?.role ?? "") });
  } catch (err) {
    if (err instanceof AuthError) {
      // The password was already set successfully (completePasswordReset
      // ran first) — a sign-in failure here would be surprising, but fail
      // safe rather than lose the "your password was reset" outcome.
      return { error: "Password reset — sign in with your new password." };
    }
    throw err;
  }
}
