import fs from "fs";
import { parseMonthlyReport } from "../src/lib/monthly-report-parser";

const files = [
  "/Users/alex/Downloads/March 2026 Monthly Report.raw.txt",
  "/Users/alex/Downloads/April 2026 Monthly Report.raw.txt",
  "/Users/alex/Downloads/May 2026 Monthly Report.raw.txt",
  "/Users/alex/Downloads/June 2026 Monthly Report.raw.txt",
  "/Users/alex/Downloads/July 2026 Monthly Report.raw.txt",
];

for (const f of files) {
  const text = fs.readFileSync(f, "utf8");
  const parsed = parseMonthlyReport(text);
  console.log("===", f.split("/").pop(), "===");
  console.log({
    reportMonth: parsed.reportMonth,
    reportLabel: parsed.reportLabel,
    auTotalSales: parsed.auTotalSales,
    auTotalPoundsSold: parsed.auTotalPoundsSold,
    auAvgRetailFlowerPricePerOz: parsed.auAvgRetailFlowerPricePerOz,
    auActiveLicensesTotal: parsed.auActiveLicensesTotal,
    medTotalSales: parsed.medTotalSales,
    auFlower: parsed.auCategoryBreakdown["Flower"],
    auVape: parsed.auCategoryBreakdown["Vape Cartridge"],
    regionCount: Object.keys(parsed.auRegionalBreakdown).length,
    wayneFlower: parsed.auRegionalBreakdown["Wayne"]?.["Flower"],
    activeLicByType_auRetailer: parsed.activeLicensesByType.adultUse["Retailer"],
    activeLicByType_medGrowerC: parsed.activeLicensesByType.medical["Grower C"],
  });
}
