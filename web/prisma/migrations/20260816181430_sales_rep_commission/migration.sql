-- AlterTable
ALTER TABLE "users" ADD COLUMN     "salesRepCommissionRate" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "sales_rep_commissions" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "salesRepId" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_rep_commissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sales_rep_commissions_dealId_key" ON "sales_rep_commissions"("dealId");

-- AddForeignKey
ALTER TABLE "sales_rep_commissions" ADD CONSTRAINT "sales_rep_commissions_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_rep_commissions" ADD CONSTRAINT "sales_rep_commissions_salesRepId_fkey" FOREIGN KEY ("salesRepId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
