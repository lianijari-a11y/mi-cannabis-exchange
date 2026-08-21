-- CreateTable
-- Up to 5 named phone numbers per lead (a business often has several real
-- contacts), ordered by sortOrder — 0 is the "main" number, 1 is "2nd
-- choice", etc. Lead.phone stays in sync with sortOrder 0 so every
-- existing phone-dependent code path keeps working unchanged.
CREATE TABLE "lead_phone_numbers" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_phone_numbers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lead_phone_numbers_leadId_idx" ON "lead_phone_numbers"("leadId");

-- AddForeignKey
ALTER TABLE "lead_phone_numbers" ADD CONSTRAINT "lead_phone_numbers_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
