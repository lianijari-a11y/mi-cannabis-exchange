"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateAnonHandle } from "@/lib/anon-handle";
import { lookupLicense } from "@/lib/license-registry";
import { ROLES, LICENSED_ROLES, ADDRESS_ROLES, roleHome, type Role } from "@/lib/constants";

export type SignupState = { error?: string } | undefined;

// Broker and Sales Rep are deliberately excluded from public self-signup —
// both get instant, zero-review, platform-wide visibility (every real
// negotiation for Broker; the whole lead CRM for Sales Rep), which a
// security review flagged as exactly the kind of access CLAUDE.md already
// describes as "the marketplace operator's own staff," not something a
// stranger should self-serve into. Admin creates those two account types
// directly now — see lib/admin.ts's createStaffAccount and
// /admin/staff/new. This check is enforced here server-side (not just by
// removing the option from signup-form.tsx's dropdown) since a client-only
// restriction is trivial to bypass by posting the form directly.
const SIGNUP_ROLES: Role[] = ["grower", "processor", "retailer", "transporter"];

export async function signup(_prevState: SignupState, formData: FormData): Promise<SignupState> {
  const roleRaw = String(formData.get("role") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();
  const businessName = String(formData.get("businessName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!ROLES.includes(roleRaw as Role) || !SIGNUP_ROLES.includes(roleRaw as Role)) {
    return { error: "Choose an account type." };
  }
  const role = roleRaw as Role;

  if (!fullName || !email) {
    return { error: "Name and email are required." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (password !== confirmPassword) {
    return { error: "Passwords don't match." };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "An account with that email already exists." };
  }

  const phone = String(formData.get("phone") ?? "").trim() || null;

  let licenseNumber: string | null = null;
  let licenseType: string | null = null;
  let licenseExpiry: Date | null = null;
  // Independent server-side lookup — never trust the client's autofill, since
  // that's just a UX convenience the browser reported back to itself.
  let registryMatch: Awaited<ReturnType<typeof lookupLicense>> | null = null;
  if (LICENSED_ROLES.includes(role as (typeof LICENSED_ROLES)[number])) {
    licenseNumber = String(formData.get("licenseNumber") ?? "").trim() || null;
    licenseType = String(formData.get("licenseType") ?? "").trim() || null;
    const licenseExpiryRaw = String(formData.get("licenseExpiry") ?? "").trim();
    licenseExpiry = licenseExpiryRaw ? new Date(licenseExpiryRaw) : null;
    if (!licenseNumber) {
      return { error: "State license number is required for this account type." };
    }
    registryMatch = await lookupLicense(licenseNumber, role);
  }

  let address: string | null = null;
  let city: string | null = null;
  let state: string | null = null;
  let zip: string | null = null;
  if (ADDRESS_ROLES.includes(role as (typeof ADDRESS_ROLES)[number])) {
    address = String(formData.get("address") ?? "").trim() || null;
    city = String(formData.get("city") ?? "").trim() || null;
    state = String(formData.get("state") ?? "").trim() || null;
    zip = String(formData.get("zip") ?? "").trim() || null;
    // Fall back to the state registry's address if the person left the field
    // blank after a license-number match — same convenience as the client
    // autofill, applied again here in case JS didn't run.
    if (registryMatch?.found) {
      address = address || registryMatch.street || null;
      city = city || registryMatch.city || null;
      state = state || registryMatch.state || null;
      zip = zip || registryMatch.zip || null;
    }
    if (!address || !city || !state || !zip) {
      return { error: "A full pickup/delivery address is required for this account type." };
    }
  }

  const finalBusinessName = businessName || registryMatch?.businessName || null;

  // Auto-approve only on a clean, currently-Active state registry match —
  // everything else (no match, License Void, Closed - Suspended, Revoked)
  // falls back to the existing manual Admin queue. See CLAUDE.md §12: a
  // license *number* match isn't proof of who's actually signing up, so this
  // is tracked distinctly (licenseAutoMatched) rather than indistinguishable
  // from a real Admin review.
  const isLicensedRole = LICENSED_ROLES.includes(role as (typeof LICENSED_ROLES)[number]);
  const autoApprove = isLicensedRole && !!registryMatch?.found && !!registryMatch?.isActive;

  const passwordHash = await bcrypt.hash(password, 10);
  const anonHandle = await generateAnonHandle(role);

  await prisma.user.create({
    data: {
      role,
      email,
      fullName,
      businessName: finalBusinessName,
      passwordHash,
      anonHandle,
      licenseNumber,
      licenseType,
      licenseExpiry,
      licenseVerification: !isLicensedRole ? "approved" : autoApprove ? "approved" : "unverified",
      licenseAutoMatched: autoApprove,
      phone,
      address,
      city,
      state,
      zip,
    },
  });

  try {
    await signIn("credentials", { email, password, redirectTo: roleHome(role) });
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: "Account created — sign in from the login page." };
    }
    throw err;
  }
}
