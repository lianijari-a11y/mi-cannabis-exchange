import { marketPulse, priceTrend } from "@/lib/market";

const TREND_ARROW = { up: "↑", down: "↓", flat: "→" } as const;
const TREND_COLOR = {
  up: "text-red-600 dark:text-red-400",
  down: "text-green-700 dark:text-green-400",
  flat: "text-gray-400",
} as const;

export async function MarketPulse() {
  const pulse = await marketPulse();
  if (pulse.length === 0) return null;

  const trends = await Promise.all(pulse.map((p) => priceTrend(p.category)));

  return (
    <div className="mb-6">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
        Market pulse
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {pulse.map((p, i) => {
          const trend = trends[i];
          return (
            <div
              key={p.category}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3"
            >
              <p className="text-[10px] uppercase tracking-wide text-gray-400">{p.label}</p>
              <p className="text-lg font-semibold text-green-700 dark:text-green-400">
                ${p.avgPrice}
                <span className="text-xs font-normal text-gray-400">/{p.unit}</span>
              </p>
              <p className="text-[10px] text-gray-400">
                avg · {p.count} active listing{p.count === 1 ? "" : "s"}
              </p>
              {trend.points.length >= 2 && (
                <p className={`text-[10px] font-medium mt-0.5 ${TREND_COLOR[trend.direction]}`}>
                  {TREND_ARROW[trend.direction]} {Math.abs(trend.changePct)}% vs {trend.points.length}wk ago
                  <span className="text-gray-400 font-normal"> (sold)</span>
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
