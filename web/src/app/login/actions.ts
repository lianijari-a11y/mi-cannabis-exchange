"use server";

import { headers } from "next/headers";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { safeRedirect } from "@/lib/safe-redirect";
import { isRateLimited, clientIp } from "@/lib/rate-limit";

export type LoginState = { error?: string; email?: string } | undefined;

// The main /login form is the one entry point every role in this app
// signs in through — Admin included — and had no rate limiting anywhere
// in its path (auth.ts's authorize() just checks email+password, nothing
// upstream throttled it). A real gap: unlike the license-first cart
// flow's own limiter (added earlier, scoped to retailers only), this is
// an unthrottled password-guessing surface against every account on the
// platform. Same Postgres-backed limiter as everywhere else in this app.
const WINDOW_MS = 60_000;
const MAX_ATTEMPTS_PER_WINDOW = 10;

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const callbackUrl = (formData.get("callbackUrl") as string) || undefined;
  const email = String(formData.get("email") ?? "").trim();

  const ip = clientIp(await headers());
  if (await isRateLimited("login", ip, WINDOW_MS, MAX_ATTEMPTS_PER_WINDOW)) {
    return { error: "Too many sign-in attempts — try again in a minute.", email };
  }

  try {
    await signIn("credentials", {
      email,
      password: formData.get("password"),
      redirectTo: safeRedirect(callbackUrl, "/"),
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: "Invalid email or password.", email };
    }
    throw err;
  }
}
