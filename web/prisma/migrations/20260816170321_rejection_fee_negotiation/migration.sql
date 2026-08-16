-- AlterTable
ALTER TABLE "deals" ADD COLUMN     "rejectionFeePayer" TEXT NOT NULL DEFAULT 'split',
ADD COLUMN     "rejectionFeeRate" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "offer_rounds" ADD COLUMN     "rejectionFeePayer" TEXT,
ADD COLUMN     "rejectionFeeRate" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "product_rejections" ADD COLUMN     "feeAmount" DOUBLE PRECISION,
ADD COLUMN     "feeGrowerOwes" DOUBLE PRECISION,
ADD COLUMN     "feePaidAt" TIMESTAMP(3),
ADD COLUMN     "feeRetailerOwes" DOUBLE PRECISION,
ADD COLUMN     "feeStatus" TEXT NOT NULL DEFAULT 'pending';
