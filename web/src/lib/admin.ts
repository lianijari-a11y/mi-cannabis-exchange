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
