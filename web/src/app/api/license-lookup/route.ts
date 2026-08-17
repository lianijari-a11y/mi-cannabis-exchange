import { NextRequest, NextResponse } from "next/server";
import { lookupLicense } from "@/lib/license-registry";
import { ROLES, type Role } from "@/lib/constants";
import { isRateLimited, clientIp } from "@/lib/rate-limit";

// This route intentionally has NO auth check — it's called from the signup
// form before an account exists, so there's no session to require. That
// makes it the one place in the app an anonymous caller can query at all,
// which is exactly what a bulk-scraping script would target to re-extract
// the whole ~3,300-row LicenseRegistry (including hasDisciplinaryAction) by
// iterating license-number formats. Rate limiting is Postgres-backed (see
// lib/rate-limit.ts) — holds across multiple serverless instances, unlike
// the in-memory Map this used to use (CLAUDE.md §21's original stopgap).
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 20;

// Signup-time only: lets the signup form autofill business name/address as
// soon as someone types a license number that's in the state registry. The
// server action re-runs this same lookup independently when the account is
// actually created — this endpoint is a UX convenience, not the source of
// truth for auto-approval.
export async function GET(req: NextRequest) {
  const ip = clientIp(req.headers);
  if (await isRateLimited("license-lookup", ip, WINDOW_MS, MAX_REQUESTS_PER_WINDOW)) {
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
