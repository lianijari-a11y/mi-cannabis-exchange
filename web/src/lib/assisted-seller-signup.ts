"use server";

import bcrypt from "bcryptjs";
import { requireAuth } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { generateAnonHandle } from "@/lib/anon-handle";
import { lookupLicense } from "@/lib/license-registry";

// A real Account Executive hit a real gap: the "post for a seller" flow
// (lib/sales-actions.ts) can only post under an EXISTING Grower/Processor
// account — it has no path for a grower who hasn't signed up yet and was
// only reached by phone. This mirrors the public signup flow's license
// lookup/auto-approve logic (signup/actions.ts, CLAUDE.md §12) as closely
// as possible rather than inventing a second, looser verification path —
// the only real difference is that an AE/Admin is typing it in on the
// grower's behalf instead of the grower typing it in themselves, and the
// license number isn't pre-scoped to one role (an AE calling a grower
// on the phone won't necessarily know if they're Class B, Class C, or
// actually a Processor) so this tries grower first, then processor.
export type CreateAssistedSellerResult =
  | { ok: true; sellerId: string; businessName: string; role: "grower" | "processor" }
  | { ok: false; error: string };

export async function createAssistedSellerAccount(formData: FormData): Promise<CreateAssistedSellerResult> {
  const session = await requireAuth();
  if (session.user.role !== "admin" && session.user.role !== "sales_rep") {
    return { ok: false, error: "Not authorized." };
  }

  const licenseNumber = String(formData.get("licenseNumber") ?? "").trim();
  const contactName = String(formData.get("contactName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!licenseNumber) {
    return { ok: false, error: "Enter the grower/processor's state license number." };
  }
  if (!contactName || !email) {
    return { ok: false, error: "Contact name and email are required." };
  }
  if (password.length < 8) {
    return { ok: false, error: "Temporary password must be at least 8 characters." };
  }

  const existingEmail = await prisma.user.findUnique({ where: { email } });
  if (existingEmail) {
    return { ok: false, error: "An account with that email already exists — search for them by name instead." };
  }
  const existingLicense = await prisma.user.findFirst({ where: { licenseNumber } });
  if (existingLicense) {
    return { ok: false, error: "An account with that license number already exists — search for them by name instead." };
  }

  let role: "grower" | "processor" | null = null;
  let match = await lookupLicense(licenseNumber, "grower");
  if (match.found) {
    role = "grower";
  } else {
    match = await lookupLicense(licenseNumber, "processor");
    if (match.found) role = "processor";
  }
  if (!role || !match.found) {
    return { ok: false, error: "No active grower or processor license found for that number in the state registry." };
  }

  // Same auto-approve rule as public signup: only a clean, currently-Active
  // registry match skips the manual Admin review queue. A license *number*
  // match isn't proof of who's actually behind this account any more than
  // it is at signup — licenseAutoMatched keeps that distinction visible in
  // Admin's user list, same badge, same honesty caveat (CLAUDE.md §12).
  const autoApprove = !!match.isActive;
  const passwordHash = await bcrypt.hash(password, 10);
  const anonHandle = await generateAnonHandle(role);

  const seller = await prisma.user.create({
    data: {
      role,
      email,
      fullName: contactName,
      businessName: match.businessName ?? null,
      passwordHash,
      anonHandle,
      licenseNumber,
      licenseVerification: autoApprove ? "approved" : "unverified",
      licenseAutoMatched: autoApprove,
      address: match.street ?? null,
      city: match.city ?? null,
      state: match.state ?? null,
      zip: match.zip ?? null,
    },
  });

  return {
    ok: true,
    sellerId: seller.id,
    businessName: seller.businessName ?? seller.fullName,
    role,
  };
}
