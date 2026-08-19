import "server-only";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { generateAnonHandle } from "@/lib/anon-handle";
import { groupListingsIntoMenus } from "@/lib/sales-actions";

// Added 2026-08-17 — Broker and Sales Rep were removed from public signup
// (see CLAUDE.md and signup/actions.ts's SIGNUP_ROLES) after a security
// review flagged that both roles get instant, zero-review, platform-wide
// visibility (every real negotiation for Broker; the entire lead CRM for
// Sales Rep) — exactly the kind of access this app documents as "the
// marketplace operator's own staff," not something a stranger should be
// able to self-serve into. This is the replacement path: only an Admin can
// create one of these two accounts.
export async function createStaffAccount(params: {
  role: "broker" | "sales_rep";
  fullName: string;
  businessName?: string | null;
  email: string;
  password: string;
  phone?: string | null;
}) {
  const email = params.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error("An account with that email already exists.");
  if (params.password.length < 8) throw new Error("Password must be at least 8 characters.");

  const passwordHash = await bcrypt.hash(params.password, 10);
  const anonHandle = await generateAnonHandle(params.role);

  return prisma.user.create({
    data: {
      role: params.role,
      email,
      fullName: params.fullName.trim(),
      businessName: params.businessName?.trim() || null,
      passwordHash,
      anonHandle,
      // Neither role is in LICENSED_ROLES, so there's no license to review —
      // same "approved" default the self-serve signup path already used for
      // these two roles, just now gated behind Admin creating the account
      // in the first place instead of anyone reaching it directly.
      licenseVerification: "approved",
      phone: params.phone?.trim() || null,
    },
  });
}

export async function pendingLicenseUsers() {
  return prisma.user.findMany({
    where: { licenseVerification: "unverified" },
    orderBy: { createdAt: "asc" },
  });
}

export async function allUsers() {
  return prisma.user.findMany({
    include: { assignedSalesRep: { select: { businessName: true, fullName: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function setLicenseVerification(
  userId: string,
  status: "approved" | "rejected"
) {
  await prisma.user.update({ where: { id: userId }, data: { licenseVerification: status } });
}

export async function setPreferredTransporter(userId: string, preferred: boolean) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (user?.role !== "transporter") throw new Error("Not a transporter account.");
  await prisma.user.update({ where: { id: userId }, data: { preferredTransporter: preferred } });
}

// Distribution control — see CLAUDE.md §18 and the note on Listing.visibility
// in schema.prisma. A confirmed, documented reversal of the original
// "every listing visible to every retailer" rule (decision #3).
export async function allListingsForAdmin() {
  return prisma.listing.findMany({
    include: { postedBy: { select: { businessName: true, fullName: true, role: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function retailersForPicker() {
  return prisma.user.findMany({
    where: { role: "retailer" },
    select: { id: true, businessName: true, fullName: true, anonHandle: true },
    orderBy: { businessName: "asc" },
  });
}

export async function setListingVisibility(
  listingId: string,
  visibility: "all" | "exclusive",
  exclusiveRetailerIds: string[]
) {
  await prisma.listing.update({
    where: { id: listingId },
    data: {
      visibility,
      exclusiveRetailerIds: visibility === "exclusive" ? exclusiveRetailerIds : [],
    },
  });
}

// Standing commission rate for a Sales Rep — see SalesRepCommission in
// schema.prisma and CLAUDE.md §18. 0-100%, Admin's own judgment call, same
// shape as Broker's per-deal commission rate but set once per rep rather
// than negotiated per deal.
export async function setSalesRepCommissionRate(userId: string, rate: number) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (user?.role !== "sales_rep") throw new Error("Not a sales rep account.");
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
    throw new Error("Commission rate must be between 0 and 100%.");
  }
  await prisma.user.update({ where: { id: userId }, data: { salesRepCommissionRate: rate } });
}

export async function allSalesRepsWithCommissions() {
  const [reps, commissions] = await Promise.all([
    prisma.user.findMany({ where: { role: "sales_rep" }, orderBy: { businessName: "asc" } }),
    prisma.salesRepCommission.findMany({
      include: { deal: { include: { thread: { include: { listing: { select: { strainName: true } } } } } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return reps.map((rep) => ({
    rep,
    commissions: commissions.filter((c) => c.salesRepId === rep.id),
  }));
}

export async function markSalesRepCommissionPaid(commissionId: string) {
  await prisma.salesRepCommission.update({
    where: { id: commissionId },
    data: { status: "paid", paidAt: new Date() },
  });
}

const EXPIRY_WARNING_DAYS = 90;

// Licensed users (grower/processor/retailer/transporter) whose license
// expires within the warning window, or has already expired. Sorted
// soonest-first so the most urgent renewals surface at the top.
// Admin-wide operational snapshot (POS hardening plan, Phase 5) — covers
// every retailer/location at once, built entirely from data already being
// captured elsewhere in the app (no new logging infrastructure). Recent
// METRC submission outcomes already have their own dedicated view at
// /admin/metrc (lib/metrc-integration.ts's recentSaleMetrcOutcomes), not
// duplicated here.
//
// Rate-limit info is a live snapshot, not a history — RateLimitBucket
// (lib/rate-limit.ts) only tracks the CURRENT window's count per key, not
// a log of past rejection events, so "currently rate-limited" is the
// honest thing to show rather than fabricating a timeline that isn't
// actually captured anywhere.
const RATE_LIMIT_SCOPES: { scope: string; label: string; maxRequests: number }[] = [
  { scope: "license-lookup", label: "License lookup (signup autofill)", maxRequests: 20 },
  { scope: "storefront-order", label: "Storefront order placement", maxRequests: 10 },
];

export async function systemHealthSnapshot() {
  const [voidedSales, buckets] = await Promise.all([
    prisma.sale.findMany({
      where: { status: "voided" },
      select: {
        id: true,
        saleNumber: true,
        total: true,
        createdAt: true,
        retailer: { select: { businessName: true, fullName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    prisma.rateLimitBucket.findMany({
      where: { windowStart: { gte: new Date(Date.now() - 60_000) } },
    }),
  ]);

  const currentlyRateLimited = buckets
    .map((b) => {
      const [scope, ...rest] = b.key.split(":");
      const config = RATE_LIMIT_SCOPES.find((s) => s.scope === scope);
      if (!config || b.count <= config.maxRequests) return null;
      return { scope: config.label, identifier: rest.join(":"), count: b.count, limit: config.maxRequests };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.count - a.count);

  return { voidedSales, currentlyRateLimited };
}

// Admin's own version of accountsForSalesRep (CLAUDE.md §38/§39) —
// platform-wide, every Grower/Processor, not just accounts assigned to
// one Account Executive. "Assigned rep" is surfaced here too so Admin can
// see who (if anyone) is dedicated to each account, same oversight-not-a-
// new-capability posture as the existing "Assigned rep" column on the
// all-users table.
export async function accountsForAdmin() {
  return prisma.user.findMany({
    where: { role: { in: ["grower", "processor"] } },
    select: {
      id: true,
      businessName: true,
      fullName: true,
      email: true,
      role: true,
      licenseVerification: true,
      assignedSalesRep: { select: { fullName: true } },
      _count: { select: { listings: true } },
    },
    orderBy: { businessName: "asc" },
  });
}

// Admin's version of accountDetailForSalesRep — no assignment check, so
// any grower/processor's full profile + comprehensive menu is reachable,
// matching Admin's unrestricted reach everywhere else in this app.
export async function accountDetailForAdmin(sellerId: string) {
  const seller = await prisma.user.findFirst({
    where: { id: sellerId, role: { in: ["grower", "processor"] } },
    select: {
      id: true,
      businessName: true,
      fullName: true,
      email: true,
      phone: true,
      role: true,
      licenseNumber: true,
      licenseType: true,
      licenseVerification: true,
      licenseExpiry: true,
      address: true,
      city: true,
      state: true,
      zip: true,
      createdAt: true,
      assignedSalesRep: { select: { fullName: true } },
    },
  });
  if (!seller) return null;

  const listings = await prisma.listing.findMany({
    where: { postedById: sellerId },
    include: { media: true },
    orderBy: { createdAt: "desc" },
  });

  return { seller, menus: groupListingsIntoMenus(listings) };
}

export async function licenseExpiryAlerts() {
  const cutoff = new Date(Date.now() + EXPIRY_WARNING_DAYS * 24 * 60 * 60 * 1000);
  const users = await prisma.user.findMany({
    where: { licenseExpiry: { lte: cutoff } },
    orderBy: { licenseExpiry: "asc" },
  });
  const now = Date.now();
  return users.map((u) => ({
    ...u,
    daysLeft: u.licenseExpiry
      ? Math.round((u.licenseExpiry.getTime() - now) / (24 * 60 * 60 * 1000))
      : null,
  }));
}
