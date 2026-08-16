import "server-only";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/constants";

// Maps a signup role to the LicenseRegistry category/categories that are
// valid for it. Grower covers both Class B and Class C state license types.
const ROLE_CATEGORIES: Partial<Record<Role, string[]>> = {
  grower: ["grower_b", "grower_c"],
  processor: ["processor"],
  retailer: ["retailer"],
  transporter: ["transporter"],
};

// Only "Active" from the state's own status vocabulary counts as a clean
// match for auto-approval. "License Void", "Closed - Suspended", "Revoked",
// and anything else falls back to the existing manual Admin review — see
// CLAUDE.md §12.
const ACTIVE_STATUSES = new Set(["Active"]);

export type LicenseLookupResult = {
  found: boolean;
  businessName?: string;
  street?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  status?: string;
  isActive?: boolean;
  hasDisciplinaryAction?: boolean;
};

// Looks up a license number against the imported state registry, scoped to
// the categories valid for the given role (a retailer account shouldn't
// auto-match against a transporter license, etc). Case/whitespace-insensitive
// since people retype these by hand.
export async function lookupLicense(licenseNumber: string, role: Role): Promise<LicenseLookupResult> {
  const categories = ROLE_CATEGORIES[role];
  const cleaned = licenseNumber.trim();
  if (!categories || !cleaned) return { found: false };

  const row = await prisma.licenseRegistry.findFirst({
    where: {
      licenseNumber: { equals: cleaned, mode: "insensitive" },
      category: { in: categories },
    },
  });

  if (!row) return { found: false };

  return {
    found: true,
    businessName: row.businessName,
    street: row.street,
    city: row.city,
    state: row.state,
    zip: row.zip,
    status: row.status,
    isActive: ACTIVE_STATUSES.has(row.status),
    hasDisciplinaryAction: row.hasDisciplinaryAction,
  };
}
