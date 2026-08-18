-- AlterTable
ALTER TABLE "users" ADD COLUMN     "retailerOwnerId" TEXT;

-- CreateIndex
CREATE INDEX "users_retailerOwnerId_idx" ON "users"("retailerOwnerId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_retailerOwnerId_fkey" FOREIGN KEY ("retailerOwnerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
