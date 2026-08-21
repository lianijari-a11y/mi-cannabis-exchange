-- AlterTable
-- Geocoded coordinates for grower/processor/retailer addresses
-- (lib/geocoding.ts, gated behind GOOGLE_MAPS_API_KEY). Null until a
-- geocode attempt succeeds.
ALTER TABLE "users" ADD COLUMN "addressLat" DOUBLE PRECISION;
ALTER TABLE "users" ADD COLUMN "addressLng" DOUBLE PRECISION;
ALTER TABLE "users" ADD COLUMN "geocodedAt" TIMESTAMP(3);
