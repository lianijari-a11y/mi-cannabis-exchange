"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateAnonHandle } from "@/lib/anon-handle";
import { lookupLicense } from "@/lib/license-registry";
import type { LicenseSearchResult } from "@/lib/assisted-seller-signup";

// The retailer-side mirror of lib/assisted-seller-signup.ts's grower quick
// signup — this is the "their broker who is admin create their profile and
// submit the offer on their behalf" path from CLAUDE.md §36. §36 originally
// kept this Admin-only on purpose, matching the human's own wording ("their
// broker who is admin") — reasoning being an AE has no standing relationship
// with retailers the way it does with the sellers it solicits. That was a
// real, confirmed reversal later, not an oversight (see
// lib/public-respond-actions.ts's comment on the same change) — the human
// asked directly whether an Account Executive could also submit an offer on
// a buyer's behalf, and confirmed yes. Kept the original reasoning here
// rather than deleting it, same "record the reversal, don't silently
// overwrite" posture used throughout this codebase.
async function requireAdminOrSalesRep() {
  const session = await auth();
  if (!session?.user || (session.user.role !== "admin" && session.user.role !== "sales_rep")) {
    redirect("/login");
  }
  return session;
}

export async function searchRetailerLicenseRegistry(
  query: string,
  mode: "number" | "name" | "phone"
): Promise<LicenseSearchResult[]> {
  await requireAdminOrSalesRep();

  const q = query.trim();
  if (!q) return [];

  if (mode === "number") {
    return prisma.licenseRegistry.findMany({
      where: { category: "retailer", licenseNumber: { contains: q, mode: "insensitive" } },
      take: 10,
      orderBy: { businessName: "asc" },
    });
  }
  if (mode === "name") {
    return prisma.licenseRegistry.findMany({
      where: { category: "retailer", businessName: { contains: q, mode: "insensitive" } },
      take: 10,
      orderBy: { businessName: "asc" },
    });
  }
  const qDigits = q.replace(/\D/g, "");
  if (qDigits.length < 4) return [];
  const candidates = await prisma.licenseRegistry.findMany({
    where: { category: "retailer", phone: { not: null } },
    take: 500,
  });
  return candidates.filter((c) => (c.phone ?? "").replace(/\D/g, "").includes(qDigits)).slice(0, 10);
}

export type CreateRetailerResult =
  | { ok: true; retailerId: string; businessName: string }
  | { ok: false; error: string };

export async function createRetailerAccountForAdmin(formData: FormData): Promise<CreateRetailerResult> {
  await requireAdminOrSalesRep();

  const licenseNumber = String(formData.get("licenseNumber") ?? "").trim();
  const contactName = String(formData.get("contactName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!licenseNumber) return { ok: false, error: "Choose a retailer license first." };
  if (!contactName || !email) return { ok: false, error: "Contact name and email are required." };
  if (password.length < 8) return { ok: false, error: "Temporary password must be at least 8 characters." };

  const existingEmail = await prisma.user.findUnique({ where: { email } });
  if (existingEmail) return { ok: false, error: "An account with that email already exists." };
  const existingLicense = await prisma.user.findFirst({ where: { licenseNumber } });
  if (existingLicense) return { ok: false, error: "An account with that license number already exists." };

  const match = await lookupLicense(licenseNumber, "retailer");
  if (!match.found) {
    return { ok: false, error: "No retailer license found for that number in the state registry." };
  }

  const autoApprove = !!match.isActive;
  const passwordHash = await bcrypt.hash(password, 10);
  const anonHandle = await generateAnonHandle("retailer");

  const retailer = await prisma.user.create({
    data: {
      role: "retailer",
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
      // This password is a temp one Admin just typed in and will relay to
      // the retailer — the license-first inline sign-in flow on a public
      // menu/collection link (components/cart/license-auth-flow.tsx)
      // checks this to prompt for a real password instead of the
      // temporary one nobody expects the retailer to remember.
      mustChangePassword: true,
    },
  });

  return { ok: true, retailerId: retailer.id, businessName: retailer.businessName ?? retailer.fullName };
}

// For an Admin picking an EXISTING retailer instead of creating a new one —
// same shape as components/sales/seller-picker's search, scoped to retailer.
export type ExistingRetailerResult = {
  id: string;
  businessName: string | null;
  fullName: string;
  email: string;
  licenseVerification: string;
};

export async function searchExistingRetailers(query: string): Promise<ExistingRetailerResult[]> {
  await requireAdminOrSalesRep();
  const q = query.trim();
  if (!q) return [];
  return prisma.user.findMany({
    where: {
      role: "retailer",
      OR: [
        { businessName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ],
    },
    select: { id: true, businessName: true, fullName: true, email: true, licenseVerification: true },
    take: 10,
    orderBy: { businessName: "asc" },
  });
}
