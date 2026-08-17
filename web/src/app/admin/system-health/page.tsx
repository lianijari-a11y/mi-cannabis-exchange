import { requireRole } from "@/lib/dal";
import { PortalShell } from "@/components/portal-shell";
import { systemHealthSnapshot } from "@/lib/admin";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/listings", label: "All listings" },
  { href: "/admin/listings/new", label: "Post for a seller" },
  { href: "/admin/staff/new", label: "Add staff account" },
  { href: "/admin/sales-reps", label: "Account Executive earnings" },
  { href: "/admin/data-uploads", label: "Data uploads" },
  { href: "/admin/metrc", label: "METRC" },
  { href: "/admin/system-health", label: "System health" },
  { href: "/admin/marketing", label: "Marketing suite" },
];

const money = (n: number) => `$${n.toFixed(2)}`;

export default async function AdminSystemHealthPage() {
  await requireRole("admin");
  const { voidedSales, currentlyRateLimited } = await systemHealthSnapshot();

  return (
    <PortalShell roleLabel="Admin" navItems={NAV}>
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">System health</h1>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-6 max-w-2xl">
        A cross-retailer, cross-location operational view built from data already captured
        elsewhere in the app — no new logging infrastructure. Recent METRC submission outcomes
        have their own dedicated page at{" "}
        <a href="/admin/metrc" className="underline">
          /admin/metrc
        </a>
        , not repeated here. This is a dashboard someone checks, not proactive alerting — no
        SMS/email/paging exists anywhere in this app yet.
      </p>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Currently rate-limited ({currentlyRateLimited.length})
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 max-w-xl">
          A live snapshot of the current window, not a history — the underlying table only
          tracks each identifier&apos;s count in its current window, not a log of past rejections.
        </p>
        {currentlyRateLimited.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Nothing is currently over its rate limit.
          </p>
        ) : (
          <div className="space-y-2">
            {currentlyRateLimited.map((r) => (
              <div
                key={`${r.scope}:${r.identifier}`}
                className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 flex items-center justify-between text-sm"
              >
                <span className="text-gray-900 dark:text-gray-100">
                  {r.scope} <span className="text-xs text-gray-400">({r.identifier})</span>
                </span>
                <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                  {r.count}/{r.limit} this window
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Recently voided sales ({voidedSales.length})
        </h2>
        {voidedSales.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No voided sales on file.</p>
        ) : (
          <div className="space-y-2">
            {voidedSales.map((s) => (
              <div
                key={s.id}
                className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 flex items-center justify-between text-sm"
              >
                <span className="text-gray-900 dark:text-gray-100">
                  {s.retailer.businessName ?? s.retailer.fullName}{" "}
                  <span className="text-xs text-gray-400">
                    Sale #{s.saleNumber} · {s.createdAt.toISOString().slice(0, 10)}
                  </span>
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{money(s.total)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </PortalShell>
  );
}
