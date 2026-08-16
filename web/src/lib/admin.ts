import "server-only";
import { prisma } from "@/lib/prisma";

export async function pendingLicenseUsers() {
  return prisma.user.findMany({
    where: { licenseVerification: "unverified" },
    orderBy: { createdAt: "asc" },
  });
}

export async function allUsers() {
  return prisma.user.findMany({ orderBy: { createdAt: "desc" } });
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
