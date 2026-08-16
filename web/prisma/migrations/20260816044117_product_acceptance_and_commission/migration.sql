-- AlterTable
ALTER TABLE "deals" ADD COLUMN     "productDecisionAt" TIMESTAMP(3),
ADD COLUMN     "productStatus" TEXT NOT NULL DEFAULT 'pending';

-- CreateTable
CREATE TABLE "commissions" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "setByBrokerId" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "payerType" TEXT NOT NULL,
    "splitGrowerPct" DOUBLE PRECISION,
    "amount" DOUBLE PRECISION,
    "growerOwes" DOUBLE PRECISION,
    "retailerOwes" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "commissions_dealId_key" ON "commissions"("dealId");

-- AddForeignKey
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_setByBrokerId_fkey" FOREIGN KEY ("setByBrokerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
