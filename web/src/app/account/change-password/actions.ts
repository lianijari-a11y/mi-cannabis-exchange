"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { setPasswordAfterForcedChange } from "@/lib/account-management";
import { roleHome } from "@/lib/constants";

export type ForcedChangeState = { error?: string } | undefined;

export async function changePasswordAfterForceAction(
  _prevState: ForcedChangeState,
  formData: FormData
): Promise<ForcedChangeState> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  if (password !== confirmPassword) {
    return { error: "Passwords don't match." };
  }

  try {
    await setPasswordAfterForcedChange(session.user.id, password);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't set a new password." };
  }

  redirect(roleHome(session.user.role));
}
