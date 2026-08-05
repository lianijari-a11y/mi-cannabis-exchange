import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash("password123", 10);

  await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      role: "admin",
      email: "admin@example.com",
      passwordHash: password,
      fullName: "Platform Admin",
      anonHandle: "Admin #001",
      licenseVerification: "approved",
    },
  });

  await prisma.user.upsert({
    where: { email: "broker@example.com" },
    update: {},
    create: {
      role: "broker",
      email: "broker@example.com",
      passwordHash: password,
      fullName: "Sam Broker",
      businessName: "Great Lakes Wholesale Brokerage",
      anonHandle: "Broker #001",
      licenseVerification: "approved",
    },
  });

  await prisma.user.upsert({
    where: { email: "transporter@example.com" },
    update: {},
    create: {
      role: "transporter",
      email: "transporter@example.com",
      passwordHash: password,
      fullName: "Terry Transporter",
      businessName: "Wolverine Secure Transport",
      anonHandle: "Transporter #001",
      licenseNumber: "ST-700455",
      licenseType: "Secure Transporter",
      licenseVerification: "approved",
      preferredTransporter: true,
    },
  });

  console.log(
    "Seeded admin@example.com, broker@example.com, and transporter@example.com (password: password123)"
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
