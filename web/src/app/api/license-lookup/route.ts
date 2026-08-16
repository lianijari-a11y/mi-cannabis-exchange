import { NextRequest, NextResponse } from "next/server";
import { lookupLicense } from "@/lib/license-registry";
import { ROLES, type Role } from "@/lib/constants";

// Signup-time only: lets the signup form autofill business name/address as
// soon as someone types a license number that's in the state registry. The
// server action re-runs this same lookup independently when the account is
// actually created — this endpoint is a UX convenience, not the source of
// truth for auto-approval.
export async function GET(req: NextRequest) {
  const licenseNumber = req.nextUrl.searchParams.get("licenseNumber") ?? "";
  const roleRaw = req.nextUrl.searchParams.get("role") ?? "";

  if (!ROLES.includes(roleRaw as Role)) {
    return NextResponse.json({ found: false });
  }

  const result = await lookupLicense(licenseNumber, roleRaw as Role);
  return NextResponse.json(result);
}
