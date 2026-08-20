import "server-only";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { generateAnonHandle } from "@/lib/anon-handle";

// Budtender accounts (CLAUDE.md §33) are created by the Retailer that owns
// them, scoped to Xcelerate POS only — never the wholesale marketplace.
// Same "not a licensed role, approved immediately" posture as Admin's
// createStaffAccount for Broker/Sales Rep (lib/admin.ts): a budtender never
// negotiates or holds a license themselves, the Retailer's own license
// already covers everything rung up at the register.
export async function createBudtenderAccount(
  retailerId: string,
  params: { fullName: string; email: string; password: string }
) {
  const email = params.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error("An account with that email already exists.");
  if (params.password.length < 8) throw new Error("Password must be at least 8 characters.");

  const passwordHash = await bcrypt.hash(params.password, 10);
  const anonHandle = await generateAnonHandle("budtender");

  return prisma.user.create({
    data: {
      role: "budtender",
      email,
      fullName: params.fullName.trim(),
      passwordHash,
      anonHandle,
      licenseVerification: "approved",
      retailerOwnerId: retailerId,
      // The Retailer typed this password in for their employee, not the
      // budtender themselves — same "must set a real one" signal every
      // other assisted-account-creation path in this app now sets.
      mustChangePassword: true,
    },
  });
}

export async function budtendersForRetailer(retailerId: string) {
  return prisma.user.findMany({
    where: { retailerOwnerId: retailerId, role: "budtender" },
    orderBy: { createdAt: "asc" },
    select: { id: true, fullName: true, email: true, createdAt: true },
  });
}

// A budtender account owns no data of its own — every Sale/InventoryLot/
// Customer it touches is recorded under retailerId, not the budtender's own
// user id — so removing one is a plain delete, no orphaned rows to clean up.
export async function removeBudtenderAccount(retailerId: string, budtenderId: string) {
  const budtender = await prisma.user.findUnique({ where: { id: budtenderId } });
  if (!budtender || budtender.retailerOwnerId !== retailerId) {
    throw new Error("Not authorized for this staff account.");
  }
  await prisma.user.delete({ where: { id: budtenderId } });
}
