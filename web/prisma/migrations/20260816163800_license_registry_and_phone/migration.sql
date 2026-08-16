-- AlterTable
ALTER TABLE "users" ADD COLUMN     "licenseAutoMatched" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "phone" TEXT;

-- CreateTable
CREATE TABLE "license_registry" (
    "id" TEXT NOT NULL,
    "licenseNumber" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "recordType" TEXT,
    "businessName" TEXT NOT NULL,
    "street" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "status" TEXT NOT NULL,
    "expirationDate" TIMESTAMP(3),
    "hasDisciplinaryAction" BOOLEAN NOT NULL DEFAULT false,
    "phone" TEXT,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "license_registry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "license_registry_licenseNumber_key" ON "license_registry"("licenseNumber");

-- CreateIndex
CREATE INDEX "license_registry_businessName_idx" ON "license_registry"("businessName");
