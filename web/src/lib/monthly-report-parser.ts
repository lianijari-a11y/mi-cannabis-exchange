import "server-only";

// Parses the Michigan CRA's official Monthly Report (.docx, converted to
// plain text via mammoth in lib/monthly-report.ts). This is a real
// government document with a consistent template — verified against 5 real
// monthly samples (March–July 2026) before writing this — but Claude
// doesn't control its shape, so every extraction here is defensive: a
// missing/renamed section leaves that field null rather than throwing, and
// the full raw text is stored alongside so a human can check what didn't
// map. See CLAUDE.md §18.

const CATEGORY_ORDER = [
  "Flower",
  "Shake/Trim",
  "Concentrate",
  "Inhalable Compound Concentrate",
  "Vape Cartridge",
  "Kief",
  "Infused-Edible",
  "Infused Non-Edible Solid",
  "Infused Liquid",
  "Infused Non-Edible Liquid",
] as const;

const AU_REGIONS = ["Upper Lower and UP", "Mid Lower", "Southwest", "East and Southeast", "Wayne"] as const;

const MED_ACTIVE_LICENSE_LABELS = [
  "Grower A",
  "Grower B",
  "Grower C",
  "Processor",
  "Provisioning Center",
  "Secure Transporter",
  "Safety Compliance",
] as const;

const AU_ACTIVE_LICENSE_LABELS = [
  "Class A Marijuana Grower",
  "Class B Marijuana Grower",
  "Class C Marijuana Grower",
  "Excess Grower",
  "Processor",
  "Retailer",
  "Class A Microbusiness",
  "Microbusiness",
  "Secure Transporter",
  "Safety Compliance Facility",
  "Designated Consumption Establishment",
  "Educational Research License",
  "Marijuana Event Organizer",
  "Temporary Marijuana Event",
] as const;

function toNumber(raw: string | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[$,]/g, "").trim();
  if (cleaned === "-" || cleaned === "" || cleaned === "—") return 0;
  const negParen = cleaned.match(/^\(([\d.]+)\)$/);
  const n = Number(negParen ? `-${negParen[1]}` : cleaned);
  return Number.isFinite(n) ? n : null;
}

type CategoryRow = { poundsSold: number | null; flOzSold: number | null; totalSales: number | null };
type CategoryBreakdown = Record<string, CategoryRow>;

// A line that looks like a table cell value: a lone dash (zero), or a
// number optionally $-prefixed/comma-separated/parenthesized-negative.
// Anything else (a category/region label, a section header) is not.
function isValueLine(line: string | undefined): boolean {
  if (line === undefined) return false;
  return /^-$|^\(?\$?-?[\d,]+(\.\d+)?\)?$/.test(line);
}

// Finds `label` as a line (exact match after trim), then reads up to the
// next three consecutive value-looking lines as [poundsSold, flOzSold,
// totalSales]. Deliberately doesn't assume exactly 3 lines are always
// present — mammoth's text extraction occasionally drops an empty cell
// (a "-" placeholder) entirely rather than emitting it, and consuming a
// fixed offset in that case would desync every category/region after it.
// Stopping at the first non-value line keeps that desync from cascading,
// at the cost of that one row's fields possibly shifting by one slot —
// verified against 5 real monthly reports; see CLAUDE.md §18.
function readCategoryRow(
  lines: string[],
  label: string,
  fromIdx: number
): { row: CategoryRow; nextIdx: number } {
  const idx = lines.indexOf(label, fromIdx);
  if (idx === -1) return { row: { poundsSold: null, flOzSold: null, totalSales: null }, nextIdx: fromIdx };

  const values: string[] = [];
  let cursor = idx + 1;
  while (values.length < 3 && isValueLine(lines[cursor])) {
    values.push(lines[cursor]);
    cursor++;
  }
  return {
    row: {
      poundsSold: toNumber(values[0]),
      flOzSold: toNumber(values[1]),
      totalSales: toNumber(values[2]),
    },
    nextIdx: cursor,
  };
}

function readProductSalesBlock(
  lines: string[],
  fromIdx: number,
  monthTotalLabel: string
): { breakdown: CategoryBreakdown; total: CategoryRow; nextIdx: number } {
  const breakdown: CategoryBreakdown = {};
  let cursor = fromIdx;
  for (const category of CATEGORY_ORDER) {
    const { row, nextIdx } = readCategoryRow(lines, category, cursor);
    breakdown[category] = row;
    cursor = Math.max(cursor, nextIdx);
  }
  const { row: total, nextIdx } = readCategoryRow(lines, monthTotalLabel, cursor);
  return { breakdown, total, nextIdx };
}

function readLabelValuePair(lines: string[], labelPrefix: string, fromIdx = 0): number | null {
  const idx = lines.findIndex((l, i) => i >= fromIdx && l.startsWith(labelPrefix));
  if (idx === -1) return null;
  return toNumber(lines[idx + 1]);
}

// The document uses two different table layouts for "Active Licenses"
// depending on section — verified against 5 real monthly reports:
//   Medical:    all labels first, then "Total", then all values in the
//               same order (label-block, then value-block).
//   Adult-Use:  [label, value] pairs interleaved row by row, ending with
//               "{Month} Total" and its value.
// Both are read defensively: any label out of place bails out to null
// rather than risk mis-assigning a count to the wrong license type.
function readActiveLicenseBlockGrouped(
  lines: string[],
  labels: readonly string[],
  fromIdx: number
): { byType: Record<string, number | null>; total: number | null; nextIdx: number } {
  const headerIdx = lines.indexOf("Active Licenses", fromIdx);
  if (headerIdx === -1) return { byType: {}, total: null, nextIdx: fromIdx };

  let cursor = headerIdx + 1;
  for (const label of labels) {
    if (lines[cursor] !== label) return { byType: {}, total: null, nextIdx: fromIdx };
    cursor++;
  }
  if (lines[cursor] !== "Total") return { byType: {}, total: null, nextIdx: fromIdx };
  cursor++;

  const byType: Record<string, number | null> = {};
  for (const label of labels) {
    byType[label] = toNumber(lines[cursor]);
    cursor++;
  }
  const total = toNumber(lines[cursor]);
  cursor++;
  return { byType, total, nextIdx: cursor };
}

function readActiveLicenseBlockInterleaved(
  lines: string[],
  labels: readonly string[],
  totalLabel: string,
  fromIdx: number
): { byType: Record<string, number | null>; total: number | null; nextIdx: number } {
  const headerIdx = lines.indexOf("Active Licenses", fromIdx);
  if (headerIdx === -1) return { byType: {}, total: null, nextIdx: fromIdx };

  let cursor = headerIdx + 1;
  const byType: Record<string, number | null> = {};
  for (const label of labels) {
    if (lines[cursor] !== label) return { byType: {}, total: null, nextIdx: fromIdx };
    byType[label] = toNumber(lines[cursor + 1]);
    cursor += 2;
  }
  const total = lines[cursor] === totalLabel ? toNumber(lines[cursor + 1]) : null;
  cursor += 2;
  return { byType, total, nextIdx: cursor };
}

function readRegionalBreakdown(
  lines: string[],
  fromIdx: number,
  monthTotalLabel: string
): { byRegion: Record<string, CategoryBreakdown>; nextIdx: number } {
  const byRegion: Record<string, CategoryBreakdown> = {};
  let cursor = fromIdx;
  for (const region of AU_REGIONS) {
    const idx = lines.indexOf(region, cursor);
    if (idx === -1) continue;
    const { breakdown, nextIdx } = readProductSalesBlock(lines, idx + 1, monthTotalLabel);
    byRegion[region] = breakdown;
    cursor = nextIdx;
  }
  return { byRegion, nextIdx: cursor };
}

export type ParsedMonthlyReport = {
  reportMonth: Date | null;
  reportLabel: string | null;
  auTotalSales: number | null;
  auTotalPoundsSold: number | null;
  auAvgRetailFlowerPricePerOz: number | null;
  auSalesToDate: number | null;
  auActiveLicensesTotal: number | null;
  medTotalSales: number | null;
  medTotalPoundsSold: number | null;
  medAvgRetailFlowerPricePerOz: number | null;
  auCategoryBreakdown: CategoryBreakdown;
  medCategoryBreakdown: CategoryBreakdown;
  auRegionalBreakdown: Record<string, CategoryBreakdown>;
  medRegionalBreakdown: Record<string, CategoryBreakdown>;
  activeLicensesByType: { medical: Record<string, number | null>; adultUse: Record<string, number | null> };
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function parseMonthlyReport(rawText: string): ParsedMonthlyReport {
  const lines = rawText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // "Monthly Report July 1, 2026 – July 31, 2026" — mammoth sometimes drops
  // the space between "Report" and the month name entirely, so this is
  // deliberately lax (\s*, not \s+) between them.
  const headerMatch = rawText.match(/Monthly Report\s*(\w+)\s+1,\s*(\d{4})/);
  const monthName = headerMatch?.[1] ?? null;
  const year = headerMatch?.[2] ? Number(headerMatch[2]) : null;
  const monthIndex = monthName ? MONTH_NAMES.findIndex((m) => m.toLowerCase() === monthName.toLowerCase()) : -1;
  const reportMonth = monthIndex >= 0 && year ? new Date(Date.UTC(year, monthIndex, 1)) : null;
  const reportLabel = monthName && year ? `${monthName} ${year}` : null;
  const monthTotalLabel = monthName ? `${monthName} Total` : "";

  // Medical section comes first in the document, Adult-Use second — both
  // use identical "Sales by Product Type" headers, so anchor on the
  // section title immediately before each to disambiguate.
  const medSectionIdx = lines.indexOf("Medical Marijuana Facility Licensing");
  const auSectionIdx = lines.indexOf("Adult-Use Establishment Licensing");

  const medSalesIdx = lines.indexOf("Sales by Product Type", Math.max(medSectionIdx, 0));
  const auSalesIdx = lines.indexOf("Sales by Product Type", Math.max(auSectionIdx, 0));

  const medBlock = medSalesIdx >= 0 ? readProductSalesBlock(lines, medSalesIdx + 1, monthTotalLabel) : null;
  const auBlock = auSalesIdx >= 0 ? readProductSalesBlock(lines, auSalesIdx + 1, monthTotalLabel) : null;

  const auAvgRetailFlowerPricePerOz = readLabelValuePair(
    lines,
    "Average Retail Flower Price",
    Math.max(auSectionIdx, 0)
  );
  const medAvgRetailFlowerPricePerOz = readLabelValuePair(
    lines,
    "Average Retail Flower Price",
    Math.max(medSectionIdx, 0)
  );
  const auSalesToDate = readLabelValuePair(lines, "Sales To Date", Math.max(auSectionIdx, 0));

  const medActive = medSectionIdx >= 0
    ? readActiveLicenseBlockGrouped(lines, MED_ACTIVE_LICENSE_LABELS, medSectionIdx)
    : { byType: {}, total: null, nextIdx: 0 };
  const auActive = auSectionIdx >= 0
    ? readActiveLicenseBlockInterleaved(lines, AU_ACTIVE_LICENSE_LABELS, monthTotalLabel, auSectionIdx)
    : { byType: {}, total: null, nextIdx: 0 };

  const medRegionAnchor = lines.indexOf("15.  Sales By Region", Math.max(medSectionIdx, 0));
  const auRegionAnchor = lines.indexOf("22.  Sales By Region", Math.max(auSectionIdx, 0));
  const medRegional = medRegionAnchor >= 0
    ? readRegionalBreakdown(lines, medRegionAnchor + 1, monthTotalLabel)
    : { byRegion: {}, nextIdx: 0 };
  const auRegional = auRegionAnchor >= 0
    ? readRegionalBreakdown(lines, auRegionAnchor + 1, monthTotalLabel)
    : { byRegion: {}, nextIdx: 0 };

  return {
    reportMonth,
    reportLabel,
    auTotalSales: auBlock?.total.totalSales ?? null,
    auTotalPoundsSold: auBlock?.total.poundsSold ?? null,
    auAvgRetailFlowerPricePerOz,
    auSalesToDate,
    auActiveLicensesTotal: auActive.total,
    medTotalSales: medBlock?.total.totalSales ?? null,
    medTotalPoundsSold: medBlock?.total.poundsSold ?? null,
    medAvgRetailFlowerPricePerOz,
    auCategoryBreakdown: auBlock?.breakdown ?? {},
    medCategoryBreakdown: medBlock?.breakdown ?? {},
    auRegionalBreakdown: auRegional.byRegion,
    medRegionalBreakdown: medRegional.byRegion,
    activeLicensesByType: { medical: medActive.byType, adultUse: auActive.byType },
  };
}
