-- AlterTable
ALTER TABLE "deals" ADD COLUMN "invoiceAcceptedAt" DATETIME;
ALTER TABLE "deals" ADD COLUMN "invoiceUploadedAt" DATETIME;
ALTER TABLE "deals" ADD COLUMN "invoiceUrl" TEXT;

-- CreateTable
CREATE TABLE "shipments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dealId" TEXT NOT NULL,
    "transporterId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'assigned',
    "podUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "shipments_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "shipments_transporterId_fkey" FOREIGN KEY ("transporterId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "shipment_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shipmentId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "shipment_events_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "role" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "businessName" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "licenseNumber" TEXT,
    "licenseType" TEXT,
    "licenseVerification" TEXT NOT NULL DEFAULT 'unverified',
    "preferredTransporter" BOOLEAN NOT NULL DEFAULT false,
    "anonHandle" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_users" ("anonHandle", "businessName", "createdAt", "email", "fullName", "id", "licenseNumber", "licenseType", "licenseVerification", "passwordHash", "role", "updatedAt") SELECT "anonHandle", "businessName", "createdAt", "email", "fullName", "id", "licenseNumber", "licenseType", "licenseVerification", "passwordHash", "role", "updatedAt" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_anonHandle_key" ON "users"("anonHandle");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "shipments_dealId_key" ON "shipments"("dealId");
