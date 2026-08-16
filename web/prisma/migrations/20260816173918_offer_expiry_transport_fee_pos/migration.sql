-- AlterTable
ALTER TABLE "offer_threads" ADD COLUMN     "expiresAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "shipments" ADD COLUMN     "transportFeeAmount" DOUBLE PRECISION,
ADD COLUMN     "transportFeePaidAt" TIMESTAMP(3),
ADD COLUMN     "transportFeePayer" TEXT,
ADD COLUMN     "transportFeeSplitGrowerPct" DOUBLE PRECISION,
ADD COLUMN     "transportFeeStatus" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN     "transportInvoiceUrl" TEXT;

-- CreateTable
CREATE TABLE "pos_connections" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "autoSyncEnabled" BOOLEAN NOT NULL DEFAULT false,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pos_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_sync_logs" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "dealId" TEXT,
    "vendor" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pos_sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pos_connections_userId_key" ON "pos_connections"("userId");

-- AddForeignKey
ALTER TABLE "pos_connections" ADD CONSTRAINT "pos_connections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_sync_logs" ADD CONSTRAINT "pos_sync_logs_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "pos_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
