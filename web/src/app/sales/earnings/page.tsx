import { requireRole } from "@/lib/dal";
import { PortalShell } from "@/components/portal-shell";
import { salesForRep } from "@/lib/sales-actions";

const NAV = [
  { href: "/sales", label: "My activity" },
  { href: "/sales/listings/new", label: "Post for a seller" },
  { href: "/sales/earnings", label: "My earnings" },
  { href: "/sales/marketing", label: "Marketing suite" },
];

const DEAL_STAGE_LABELS: Record<string, string> = {
  pending: "In progress",
  accepted: "Delivered & accepted",
  rejected: "Delivered & rejected",
};

export default async function SalesRepEarningsPage() {
  const session = await requireRole("sales_rep");
  const sales = await salesForRep(session.user.id);

  const totalPending = sales.reduce(
    (sum, s) => sum + (s.salesRepCommission && s.salesRepCommission.status === "pending" ? s.salesRepCommission.amount : 0),
    0
  );
  const totalPaid = sales.reduce(
    (sum, s) => sum + (s.salesRepCommission && s.salesRepCommission.status === "paid" ? s.salesRepCommission.amount : 0),
    0
  );

  return (
    <PortalShell roleLabel="Account Executive" navItems={NAV}>
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">My earnings</h1>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        Deals closed from listings you posted. Commission is set by Admin as a standing rate on
        your account, and is computed once the retailer accepts the delivered product.
      </p>

      <div className="flex gap-4 mb-6 text-sm">
        <span className="text-gray-700 dark:text-gray-300">
          <span className="font-semibold text-amber-700 dark:text-amber-400">${totalPending}</span> pending
        </span>
        <span className="text-gray-700 dark:text-gray-300">
          <span className="font-semibold text-green-700 dark:text-green-400">${totalPaid}</span> paid
        </span>
      </div>

      {sales.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">No deals closed yet from your listings.</p>
      ) : (
        <div className="space-y-2">
          {sales.map((s) => (
            <div
              key={s.id}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 flex items-center justify-between flex-wrap gap-2"
            >
              <div>
                <p className="font-medium text-sm text-gray-900 dark:text-gray-100">
                  {s.thread.listing.strainName}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  ${s.finalPrice}/unit · {s.finalQuantity} units · {DEAL_STAGE_LABELS[s.productStatus] ?? s.productStatus}
                </p>
              </div>
              <div className="text-xs text-right">
                {s.salesRepCommission ? (
                  <span
                    className={
                      s.salesRepCommission.status === "paid"
                        ? "text-green-700 dark:text-green-400"
                        : "text-amber-700 dark:text-amber-400"
                    }
                  >
                    ${s.salesRepCommission.amount} ({s.salesRepCommission.rate}%) —{" "}
                    {s.salesRepCommission.status === "paid" ? "paid" : "pending"}
                  </span>
                ) : (
                  <span className="text-gray-400">Not yet computed</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </PortalShell>
  );
}
