-- AlterTable
ALTER TABLE "inventory_lots" ADD COLUMN     "thcMgPerUnit" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "customerName" TEXT,
ADD COLUMN     "orderType" TEXT NOT NULL DEFAULT 'in_store';
