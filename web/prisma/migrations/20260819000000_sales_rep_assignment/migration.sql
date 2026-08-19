-- AlterTable
ALTER TABLE "users" ADD COLUMN     "assignedSalesRepId" TEXT;

-- CreateIndex
CREATE INDEX "users_assignedSalesRepId_idx" ON "users"("assignedSalesRepId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_assignedSalesRepId_fkey" FOREIGN KEY ("assignedSalesRepId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
