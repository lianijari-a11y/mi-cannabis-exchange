-- CreateTable
CREATE TABLE "monthly_market_reports" (
    "id" TEXT NOT NULL,
    "reportMonth" TIMESTAMP(3) NOT NULL,
    "reportLabel" TEXT NOT NULL,
    "sourceFileName" TEXT,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "auTotalSales" DOUBLE PRECISION,
    "auTotalPoundsSold" DOUBLE PRECISION,
    "auAvgRetailFlowerPricePerOz" DOUBLE PRECISION,
    "auSalesToDate" DOUBLE PRECISION,
    "auActiveLicensesTotal" INTEGER,
    "medTotalSales" DOUBLE PRECISION,
    "medTotalPoundsSold" DOUBLE PRECISION,
    "medAvgRetailFlowerPricePerOz" DOUBLE PRECISION,
    "auCategoryBreakdown" JSONB,
    "medCategoryBreakdown" JSONB,
    "auRegionalBreakdown" JSONB,
    "medRegionalBreakdown" JSONB,
    "activeLicensesByType" JSONB,
    "rawExtractedText" TEXT,

    CONSTRAINT "monthly_market_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "monthly_market_reports_reportMonth_key" ON "monthly_market_reports"("reportMonth");

-- AddForeignKey
ALTER TABLE "monthly_market_reports" ADD CONSTRAINT "monthly_market_reports_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
