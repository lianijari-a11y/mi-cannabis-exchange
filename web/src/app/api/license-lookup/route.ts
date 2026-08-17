import { NextRequest, NextResponse } from "next/server";
import { lookupLicense } from "@/lib/license-registry";
import { ROLES, type Role } from "@/lib/constants";

// This route intentionally has NO auth check — it's called from the signup
// form before an account exists, so there's no session to require. That
// makes it the one place in the app an anonymous caller can query at all,
// which is exactly what a bulk-scraping script would target to re-extract
// the whole ~3,300-row LicenseRegistry (including hasDisciplinaryAction) by
// iterating license-number formats. The limiter below is a stopgap: it's
// in-memory, so it only throttles a single server instance and resets on
// cold start/restart — it will NOT hold once this runs on more than one
// serverless instance (Vercel routinely does). A real fix needs a shared
// store (e.g. Upstash Redis) keyed by IP; flagging that as a follow-up
// rather than adding a new external dependency here without being asked.
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 20;
const hitsByIp = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const hits = (hitsByIp.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  hits.push(now);
  hitsByIp.set(ip, hits);
  // Bound memory growth from the ever-growing set of distinct IPs — cheap
  // insurance since this map lives for the life of the server instance.
  if (hitsByIp.size > 5000) hitsByIp.clear();
  return hits.length > MAX_REQUESTS_PER_WINDOW;
}

// Signup-time only: lets the signup form autofill business name/address as
// soon as someone types a license number that's in the state registry. The
// server action re-runs this same lookup independently when the account is
// actually created — this endpoint is a UX convenience, not the source of
// truth for auto-approval.
export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json({ found: false, error: "Too many requests — try again in a minute." }, { status: 429 });
  }

  const licenseNumber = req.nextUrl.searchParams.get("licenseNumber") ?? "";
  const roleRaw = req.nextUrl.searchParams.get("role") ?? "";

  if (!ROLES.includes(roleRaw as Role)) {
    return NextResponse.json({ found: false });
  }

  const result = await lookupLicense(licenseNumber, roleRaw as Role);
  return NextResponse.json(result);
}
