-- AlterTable
ALTER TABLE "listing_media" ADD COLUMN     "redactionAttempted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "redactionError" TEXT,
ADD COLUMN     "redactionRegionsFound" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "listings" ADD COLUMN     "exclusiveRetailerIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "visibility" TEXT NOT NULL DEFAULT 'all';
