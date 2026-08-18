"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";

export type LoginState = { error?: string; email?: string } | undefined;

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const callbackUrl = (formData.get("callbackUrl") as string) || undefined;
  const email = String(formData.get("email") ?? "").trim();

  try {
    await signIn("credentials", {
      email,
      password: formData.get("password"),
      redirectTo: callbackUrl || "/",
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: "Invalid email or password.", email };
    }
    throw err;
  }
}
