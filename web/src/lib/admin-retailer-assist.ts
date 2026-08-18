"use server";

import bcrypt from "bcryptjs";
import { requireRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { generateAnonHandle } from "@/lib/anon-handle";
import { lookupLicense } from "@/lib/license-registry";
import type { LicenseSearchResult } from "@/lib/assisted-seller-signup";

// The retailer-side mirror of lib/assisted-seller-signup.ts's grower quick
// signup — this is the "their broker who is admin create their profile and
// submit the offer on their behalf" path from CLAUDE.md §36. Admin-only on
// purpose, matching the human's own wording ("their broker who is admin") —
// not opened up to Account Executive, since an AE builds wholesale menus on
// a seller's behalf but has no equivalent standing relationship with
// retailers responding to one.
export async function searchRetailerLicenseRegistry(
  query: string,
  mode: "number" | "name" | "phone"
): Promise<LicenseSearchResult[]> {
  await requireRole("admin");

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
  await requireRole("admin");

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
  await requireRole("admin");
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
