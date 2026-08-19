"use server";

import bcrypt from "bcryptjs";
import { requireAuth } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { generateAnonHandle } from "@/lib/anon-handle";
import { lookupLicense } from "@/lib/license-registry";
import { markLeadAssignedRep } from "@/lib/leads";

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

export type LicenseSearchResult = {
  licenseNumber: string;
  businessName: string;
  street: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  status: string;
  phone: string | null;
  category: string;
};

// Lets an AE/Admin find a grower/processor by whatever they actually have on
// hand — a phone number from a call, a business name, or the license number
// itself — while always resolving to a real State of Michigan CRA license
// number. This matters because a real Account Executive hit a case where
// their own lead-list export had a "license number" for a business that
// didn't match the state's own number for that same business at all (two
// different internal numbering schemes) — so this deliberately only ever
// searches LicenseRegistry (the actual CRA import), never the Lead/CRM data,
// even when searching by phone (LicenseRegistry.phone is itself sourced
// from a name-matched enrichment pass, not license-number matching — see
// CLAUDE.md §12/§35).
export async function searchLicenseRegistryForAssist(
  query: string,
  mode: "number" | "name" | "phone"
): Promise<LicenseSearchResult[]> {
  const session = await requireAuth();
  if (session.user.role !== "admin" && session.user.role !== "sales_rep") {
    return [];
  }

  const q = query.trim();
  if (!q) return [];

  const scope = { category: { in: ["grower_b", "grower_c", "processor"] as string[] } };

  if (mode === "number") {
    const rows = await prisma.licenseRegistry.findMany({
      where: { ...scope, licenseNumber: { contains: q, mode: "insensitive" } },
      take: 10,
      orderBy: { businessName: "asc" },
    });
    return rows;
  }

  if (mode === "name") {
    const rows = await prisma.licenseRegistry.findMany({
      where: { ...scope, businessName: { contains: q, mode: "insensitive" } },
      take: 10,
      orderBy: { businessName: "asc" },
    });
    return rows;
  }

  // Phone: stored formatted as "(xxx) xxx-xxxx" — normalize both sides to
  // digits-only and filter in JS rather than trying a partial-format SQL
  // match, since the candidate set (phone-having growers/processors) is
  // small enough that this is simpler and more reliable than a fragile
  // LIKE pattern against a formatted string.
  const qDigits = q.replace(/\D/g, "");
  if (qDigits.length < 4) return [];
  const candidates = await prisma.licenseRegistry.findMany({
    where: { ...scope, phone: { not: null } },
    take: 500,
  });
  return candidates
    .filter((c) => (c.phone ?? "").replace(/\D/g, "").includes(qDigits))
    .slice(0, 10);
}

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
      // Building this account IS the first contact — a Sales Rep who
      // creates it is immediately the assigned rep (CLAUDE.md §38). Admin
      // creating one leaves it unclaimed; Admin isn't a rep in this model.
      assignedSalesRepId: session.user.role === "sales_rep" ? session.user.id : null,
    },
  });

  if (session.user.role === "sales_rep") {
    await markLeadAssignedRep(seller.businessName, session.user.name ?? "").catch(() => {});
  }

  return {
    ok: true,
    sellerId: seller.id,
    businessName: seller.businessName ?? seller.fullName,
    role,
  };
}
