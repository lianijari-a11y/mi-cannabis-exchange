import "server-only";
import { prisma } from "@/lib/prisma";

// Postgres-backed replacement for the in-memory per-IP Map that used to
// live directly in /api/license-lookup and the storefront order action —
// see CLAUDE.md §21. That version only throttled a single server instance
// and reset on cold start; this one holds correctly across as many
// simultaneous serverless instances as the app runs on, without adding a
// new vendor (Postgres is already in use via Supabase).
//
// Fixed-window, not a precise sliding log: a request right at a window
// boundary could in theory see slightly more than the limit across two
// adjacent windows. That's an acceptable tradeoff for what this exists to
// do — blunt scripted abuse on the app's few genuinely unauthenticated
// write surfaces, not enforce an exact quota — and it costs one atomic
// upsert per request rather than a row per hit, so it stays cheap even
// under heavy traffic.
export async function isRateLimited(
  scope: string,
  identifier: string,
  windowMs: number,
  maxRequests: number
): Promise<boolean> {
  const key = `${scope}:${identifier}`;
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);

  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "rate_limit_buckets" ("key", "windowStart", "count")
    VALUES (${key}, ${windowStart}, 1)
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "rate_limit_buckets"."windowStart" = EXCLUDED."windowStart"
        THEN "rate_limit_buckets"."count" + 1
        ELSE 1
      END,
      "windowStart" = EXCLUDED."windowStart"
    RETURNING "count";
  `;

  return (rows[0]?.count ?? 0) > maxRequests;
}

// Both existing call sites derive the caller's IP the same way from a
// Headers-like object — a NextRequest's `.headers` in a route handler, or
// the `next/headers` `headers()` result in a server action. Centralized
// here so the header-precedence logic isn't duplicated a third time.
export function clientIp(headerSource: { get(name: string): string | null }): string {
  return (
    headerSource.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headerSource.get("x-real-ip") ||
    "unknown"
  );
}
