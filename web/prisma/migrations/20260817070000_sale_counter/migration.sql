-- CreateTable
CREATE TABLE "sale_counters" (
    "retailerId" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "sale_counters_pkey" PRIMARY KEY ("retailerId")
);

-- AddForeignKey
ALTER TABLE "sale_counters" ADD CONSTRAINT "sale_counters_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
