import { stateMarketTrend } from "@/lib/monthly-report";
import { CATEGORY_LABELS, type Category } from "@/lib/constants";

function fmtMoney(n: number | null) {
  if (n == null) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(2)}`;
}

// Statewide market data from the CRA's own Monthly Report (Admin-uploaded,
// see CLAUDE.md §18) — distinct from MarketPulse, which is this platform's
// own (much smaller) sample of deals. Shown across every portal per the
// human's "at the fingertips of all portals" request.
export async function StateMarketWidget() {
  const months = await stateMarketTrend();
  if (months.length === 0) return null;

  const latest = months[months.length - 1];
  const first = months[0];
  const priceChange =
    latest.avgRetailFlowerPricePerOz != null && first.avgRetailFlowerPricePerOz
      ? ((latest.avgRetailFlowerPricePerOz - first.avgRetailFlowerPricePerOz) / first.avgRetailFlowerPricePerOz) * 100
      : null;

  const categories = latest.categoryBreakdown
    ? Object.entries(latest.categoryBreakdown).filter(([, v]) => v?.totalSales != null)
    : [];

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 mb-4">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          Michigan Adult-Use Market — {latest.reportLabel}
        </h2>
        <span className="text-[10px] text-gray-400">CRA Monthly Report, statewide</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Total sales</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{fmtMoney(latest.totalSales)}</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Lbs sold</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {latest.totalPoundsSold != null ? latest.totalPoundsSold.toLocaleString() : "—"}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Avg flower $/oz</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {latest.avgRetailFlowerPricePerOz != null ? `$${latest.avgRetailFlowerPricePerOz}` : "—"}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">
            {months.length}mo trend
          </p>
          <p
            className={`text-sm font-semibold ${
              priceChange == null
                ? "text-gray-400"
                : priceChange < 0
                ? "text-red-600 dark:text-red-400"
                : "text-green-700 dark:text-green-400"
            }`}
          >
            {priceChange == null ? "—" : `${priceChange > 0 ? "+" : ""}${priceChange.toFixed(1)}%`}
          </p>
        </div>
      </div>

      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
          {categories.map(([key, v]) => (
            <span
              key={key}
              className="text-[10px] text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-full px-2 py-0.5"
            >
              {CATEGORY_LABELS[key as Category] ?? key}: {fmtMoney(v?.totalSales ?? null)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
