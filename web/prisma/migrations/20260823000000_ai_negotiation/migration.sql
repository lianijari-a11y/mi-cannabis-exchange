-- AlterTable
ALTER TABLE "offer_threads" ADD COLUMN "needsBrokerMediation" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "offer_threads" ADD COLUMN "mediationFlaggedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "offer_rounds" ADD COLUMN "aiGenerated" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ai_negotiation_mandates" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "partyRole" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "openingPrice" DOUBLE PRECISION NOT NULL,
    "walkAwayPrice" DOUBLE PRECISION NOT NULL,
    "roundsUsed" INTEGER NOT NULL DEFAULT 0,
    "maxRounds" INTEGER NOT NULL DEFAULT 5,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_negotiation_mandates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "broker_suggestions" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "brokerId" TEXT NOT NULL,
    "suggestedPrice" DOUBLE PRECISION NOT NULL,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "broker_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_negotiation_mandates_threadId_partyRole_key" ON "ai_negotiation_mandates"("threadId", "partyRole");

-- CreateIndex
CREATE INDEX "ai_negotiation_mandates_threadId_idx" ON "ai_negotiation_mandates"("threadId");

-- CreateIndex
CREATE INDEX "broker_suggestions_threadId_idx" ON "broker_suggestions"("threadId");

-- AddForeignKey
ALTER TABLE "ai_negotiation_mandates" ADD CONSTRAINT "ai_negotiation_mandates_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "offer_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_negotiation_mandates" ADD CONSTRAINT "ai_negotiation_mandates_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broker_suggestions" ADD CONSTRAINT "broker_suggestions_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "offer_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broker_suggestions" ADD CONSTRAINT "broker_suggestions_brokerId_fkey" FOREIGN KEY ("brokerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
