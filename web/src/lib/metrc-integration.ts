import "server-only";
import { prisma } from "@/lib/prisma";

// Added 2026-08-16 (second ask) — SCAFFOLDING ONLY. This module stores
// credentials; it never makes a METRC API call. See CLAUDE.md §2/§19: it
// isn't established whether "Broker" (this platform's core role, full
// visibility into every deal) is a recognized MI license category for
// wholesale transfers, and the human doesn't have real METRC API access yet
// (expected the day after this was written). Connecting real credentials is
// the trigger for that unresolved question, so this stays a stub until both
// real API access and legal review land — do not add a live call here
// without that.

export async function connectMetrc(userId: string, licenseNumber: string, userApiKey: string) {
  if (!userApiKey.trim()) throw new Error("Enter a METRC User API Key.");
  return prisma.metrcConnection.upsert({
    where: { userId },
    create: { userId, licenseNumber: licenseNumber.trim() || null, userApiKey: userApiKey.trim() },
    update: { licenseNumber: licenseNumber.trim() || null, userApiKey: userApiKey.trim() },
  });
}

export async function disconnectMetrc(userId: string) {
  await prisma.metrcConnection.deleteMany({ where: { userId } });
}

export async function metrcConnectionFor(userId: string) {
  return prisma.metrcConnection.findUnique({ where: { userId } });
}

export async function setMetrcVendorApiKey(vendorApiKey: string) {
  await prisma.metrcVendorConfig.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", vendorApiKey: vendorApiKey.trim() || null },
    update: { vendorApiKey: vendorApiKey.trim() || null },
  });
}

export async function metrcVendorConfig() {
  return prisma.metrcVendorConfig.findUnique({ where: { id: "singleton" } });
}

// Every licensee connection, for Admin's overview — real business identity,
// same trust tier as everywhere else Admin looks at the full user list.
export async function allMetrcConnectionsForAdmin() {
  return prisma.metrcConnection.findMany({
    include: { user: { select: { businessName: true, fullName: true, role: true } } },
    orderBy: { connectedAt: "desc" },
  });
}
