-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "listKey" TEXT NOT NULL,
    "primaryStatus" TEXT NOT NULL DEFAULT '',
    "company" TEXT NOT NULL,
    "contact" TEXT,
    "phone" TEXT,
    "altPhone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "license" TEXT,
    "licenseType" TEXT,
    "licenseStatus" TEXT,
    "serviceZone" TEXT,
    "notes" TEXT,
    "assignedRepName" TEXT,
    "disposition" TEXT NOT NULL DEFAULT 'NEW',
    "saleAmount" DOUBLE PRECISION,
    "callbackDate" TIMESTAMP(3),
    "calledCount" INTEGER NOT NULL DEFAULT 0,
    "lastCallAt" TIMESTAMP(3),
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_activity_logs" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "authorId" TEXT,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "leads_listKey_idx" ON "leads"("listKey");

-- CreateIndex
CREATE INDEX "leads_disposition_idx" ON "leads"("disposition");

-- CreateIndex
CREATE INDEX "lead_activity_logs_leadId_idx" ON "lead_activity_logs"("leadId");

-- AddForeignKey
ALTER TABLE "lead_activity_logs" ADD CONSTRAINT "lead_activity_logs_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
