-- AlterTable
ALTER TABLE "users" ADD COLUMN     "minimumOrderValue" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "menu_collections" (
    "id" TEXT NOT NULL,
    "salesRepId" TEXT NOT NULL,
    "batchIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "menu_collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_orders" (
    "id" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "collectionId" TEXT,
    "requestedTerms" TEXT NOT NULL,
    "facilitatedBySalesRepId" TEXT,
    "disclaimerAcknowledgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cart_orders_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "offer_threads" ADD COLUMN     "cartOrderId" TEXT;

-- CreateIndex
CREATE INDEX "offer_threads_cartOrderId_idx" ON "offer_threads"("cartOrderId");

-- AddForeignKey
ALTER TABLE "menu_collections" ADD CONSTRAINT "menu_collections_salesRepId_fkey" FOREIGN KEY ("salesRepId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_orders" ADD CONSTRAINT "cart_orders_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_orders" ADD CONSTRAINT "cart_orders_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "menu_collections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_threads" ADD CONSTRAINT "offer_threads_cartOrderId_fkey" FOREIGN KEY ("cartOrderId") REFERENCES "cart_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
