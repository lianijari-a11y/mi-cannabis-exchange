import "server-only";
import mammoth from "mammoth";
import { prisma } from "@/lib/prisma";
import { parseMonthlyReport } from "@/lib/monthly-report-parser";

// Admin uploads the CRA's .docx every month — this converts it to plain
// text (mammoth), parses it, and upserts by reportMonth so re-uploading the
// same month's file (a corrected version, say) replaces rather than
// duplicates. See CLAUDE.md §18.
export async function ingestMonthlyReport(fileBuffer: Buffer, sourceFileName: string, uploadedById: string) {
  const { value: rawText } = await mammoth.extractRawText({ buffer: fileBuffer });
  const parsed = parseMonthlyReport(rawText);

  if (!parsed.reportMonth || !parsed.reportLabel) {
    throw new Error(
      "Couldn't find a report month in this file — make sure it's an unedited CRA Monthly Report .docx."
    );
  }

  const data = {
    reportLabel: parsed.reportLabel,
    sourceFileName,
    uploadedById,
    auTotalSales: parsed.auTotalSales,
    auTotalPoundsSold: parsed.auTotalPoundsSold,
    auAvgRetailFlowerPricePerOz: parsed.auAvgRetailFlowerPricePerOz,
    auSalesToDate: parsed.auSalesToDate,
    auActiveLicensesTotal: parsed.auActiveLicensesTotal,
    medTotalSales: parsed.medTotalSales,
    medTotalPoundsSold: parsed.medTotalPoundsSold,
    medAvgRetailFlowerPricePerOz: parsed.medAvgRetailFlowerPricePerOz,
    auCategoryBreakdown: parsed.auCategoryBreakdown,
    medCategoryBreakdown: parsed.medCategoryBreakdown,
    auRegionalBreakdown: parsed.auRegionalBreakdown,
    medRegionalBreakdown: parsed.medRegionalBreakdown,
    activeLicensesByType: parsed.activeLicensesByType,
    rawExtractedText: rawText.slice(0, 50000), // fallback for a human to eyeball, capped
  };

  return prisma.monthlyMarketReport.upsert({
    where: { reportMonth: parsed.reportMonth },
    create: { reportMonth: parsed.reportMonth, ...data },
    update: data,
  });
}

export async function allMonthlyReports() {
  return prisma.monthlyMarketReport.findMany({
    orderBy: { reportMonth: "desc" },
    select: {
      id: true,
      reportMonth: true,
      reportLabel: true,
      sourceFileName: true,
      uploadedAt: true,
      auTotalSales: true,
      auTotalPoundsSold: true,
      auAvgRetailFlowerPricePerOz: true,
      auActiveLicensesTotal: true,
    },
  });
}

export async function deleteMonthlyReport(id: string) {
  await prisma.monthlyMarketReport.delete({ where: { id } });
}

export async function latestMonthlyReport() {
  return prisma.monthlyMarketReport.findFirst({ orderBy: { reportMonth: "desc" } });
}

// Category-by-category pricing/volume trend across every uploaded month —
// this is the statewide equivalent of lib/market.ts's priceTrend(), which
// only sees this platform's own (much smaller) sample of deals.
export async function stateMarketTrend(limit = 12) {
  const reports = await prisma.monthlyMarketReport.findMany({
    orderBy: { reportMonth: "asc" },
    take: limit,
    select: {
      reportMonth: true,
      reportLabel: true,
      auTotalSales: true,
      auTotalPoundsSold: true,
      auAvgRetailFlowerPricePerOz: true,
      auCategoryBreakdown: true,
    },
  });

  return reports.map((r) => ({
    reportMonth: r.reportMonth,
    reportLabel: r.reportLabel,
    totalSales: r.auTotalSales,
    totalPoundsSold: r.auTotalPoundsSold,
    avgRetailFlowerPricePerOz: r.auAvgRetailFlowerPricePerOz,
    categoryBreakdown: r.auCategoryBreakdown as Record<
      string,
      { poundsSold: number | null; flOzSold: number | null; totalSales: number | null }
    > | null,
  }));
}
