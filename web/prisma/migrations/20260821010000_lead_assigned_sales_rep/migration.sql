-- AlterTable
-- Real per-AE lead ownership (distinct from the pre-existing free-text
-- assignedRepName, which never reliably matched a logged-in account).
-- Claimed automatically on first real contact — see lib/leads.ts.
ALTER TABLE "leads" ADD COLUMN "assignedSalesRepId" TEXT;

-- CreateIndex
CREATE INDEX "leads_assignedSalesRepId_idx" ON "leads"("assignedSalesRepId");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_assignedSalesRepId_fkey" FOREIGN KEY ("assignedSalesRepId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
