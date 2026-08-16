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
