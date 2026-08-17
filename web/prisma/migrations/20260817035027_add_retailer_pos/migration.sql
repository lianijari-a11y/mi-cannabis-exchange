-- AlterTable
ALTER TABLE "metrc_vendor_config" ADD COLUMN     "useSandbox" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "inventory_lots" (
    "id" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "dealId" TEXT,
    "sku" TEXT NOT NULL,
    "metrcPackageTag" TEXT,
    "productName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "thcPercent" DOUBLE PRECISION,
    "unit" TEXT NOT NULL,
    "quantityReceived" DOUBLE PRECISION NOT NULL,
    "quantityRemaining" DOUBLE PRECISION NOT NULL,
    "unitCost" DOUBLE PRECISION NOT NULL,
    "markupPercent" DOUBLE PRECISION NOT NULL,
    "retailPricePerUnit" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales" (
    "id" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "saleNumber" INTEGER NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "taxRatePercent" DOUBLE PRECISION NOT NULL,
    "taxAmount" DOUBLE PRECISION NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "tenderType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "metrcStatus" TEXT NOT NULL DEFAULT 'not_submitted',
    "metrcError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_line_items" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "inventoryLotId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "lineTotal" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "sale_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inventory_lots_dealId_key" ON "inventory_lots"("dealId");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_lots_sku_key" ON "inventory_lots"("sku");

-- CreateIndex
CREATE INDEX "inventory_lots_retailerId_status_idx" ON "inventory_lots"("retailerId", "status");

-- CreateIndex
CREATE INDEX "sales_retailerId_status_idx" ON "sales"("retailerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "sales_retailerId_saleNumber_key" ON "sales"("retailerId", "saleNumber");

-- CreateIndex
CREATE INDEX "sale_line_items_saleId_idx" ON "sale_line_items"("saleId");

-- AddForeignKey
ALTER TABLE "inventory_lots" ADD CONSTRAINT "inventory_lots_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_lots" ADD CONSTRAINT "inventory_lots_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_line_items" ADD CONSTRAINT "sale_line_items_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_line_items" ADD CONSTRAINT "sale_line_items_inventoryLotId_fkey" FOREIGN KEY ("inventoryLotId") REFERENCES "inventory_lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
