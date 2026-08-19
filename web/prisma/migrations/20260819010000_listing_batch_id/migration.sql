-- AlterTable
ALTER TABLE "listings" ADD COLUMN     "batchId" TEXT;

-- CreateIndex
CREATE INDEX "listings_batchId_idx" ON "listings"("batchId");
