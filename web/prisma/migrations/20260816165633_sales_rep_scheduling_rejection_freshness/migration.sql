-- AlterTable
ALTER TABLE "listings" ADD COLUMN     "createdBySalesRepId" TEXT,
ADD COLUMN     "lastConfirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "shipments" ADD COLUMN     "growerAcceptedSchedule" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "retailerAcceptedSchedule" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "scheduledDeliveryAt" TIMESTAMP(3),
ADD COLUMN     "scheduledPickupAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "listing_dismissals" (
    "id" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listing_dismissals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_rejections" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "resolutionType" TEXT,
    "counterPrice" DOUBLE PRECISION,
    "counterNote" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "product_rejections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "listing_dismissals_retailerId_listingId_key" ON "listing_dismissals"("retailerId", "listingId");

-- CreateIndex
CREATE UNIQUE INDEX "product_rejections_dealId_key" ON "product_rejections"("dealId");

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_createdBySalesRepId_fkey" FOREIGN KEY ("createdBySalesRepId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_dismissals" ADD CONSTRAINT "listing_dismissals_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_dismissals" ADD CONSTRAINT "listing_dismissals_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_rejections" ADD CONSTRAINT "product_rejections_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
