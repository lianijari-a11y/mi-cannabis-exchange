"use server";

import { headers } from "next/headers";
import { requestPasswordReset, type RequestResetResult } from "@/lib/password-reset";
import { isRateLimited, clientIp } from "@/lib/rate-limit";

// Same class of anonymous, spammable surface as /api/license-lookup and
// the storefront order action — an unauthenticated visitor can hit this
// with any email address. Rate-limited the same way.
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 5;

export async function requestPasswordResetAction(
  _prevState: RequestResetResult | undefined,
  formData: FormData
): Promise<RequestResetResult> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { ok: false, error: "Enter your email address." };

  const h = await headers();
  const ip = clientIp(h);
  if (await isRateLimited("forgot-password", ip, WINDOW_MS, MAX_REQUESTS_PER_WINDOW)) {
    return { ok: false, error: "Too many requests — try again in a minute." };
  }

  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const origin = host.startsWith("localhost") || host.startsWith("127.0.0.1") ? `http://${host}` : `${proto}://${host}`;

  return requestPasswordReset(email, origin);
}
