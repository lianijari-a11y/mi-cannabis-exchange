-- AlterTable
-- Individual driver name/phone (previously only the Transporter company
-- account was recorded), plus opt-in live location while in transit
-- (lib/tracking.ts). Off by default; cleared on delivery.
ALTER TABLE "shipments" ADD COLUMN "driverName" TEXT;
ALTER TABLE "shipments" ADD COLUMN "driverPhone" TEXT;
ALTER TABLE "shipments" ADD COLUMN "locationSharingEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "shipments" ADD COLUMN "lastLat" DOUBLE PRECISION;
ALTER TABLE "shipments" ADD COLUMN "lastLng" DOUBLE PRECISION;
ALTER TABLE "shipments" ADD COLUMN "lastLocationAt" TIMESTAMP(3);
