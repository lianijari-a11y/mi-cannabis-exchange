import { requireRole } from "@/lib/dal";
import { PortalShell } from "@/components/portal-shell";
import { allSalesRepsWithCommissions } from "@/lib/admin";
import { setSalesRepRate, markSalesRepPaid } from "../actions";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/listings", label: "All listings" },
  { href: "/admin/listings/new", label: "Post for a seller" },
  { href: "/admin/sales-reps", label: "Sales rep earnings" },
  { href: "/admin/data-uploads", label: "Data uploads" },
  { href: "/admin/metrc", label: "METRC" },
  { href: "/admin/marketing", label: "Marketing suite" },
];

export default async function AdminSalesRepsPage() {
  await requireRole("admin");
  const reps = await allSalesRepsWithCommissions();

  return (
    <PortalShell roleLabel="Admin" navItems={NAV}>
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">Sales rep earnings</h1>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
        Standing commission rate applies automatically to every deal that closes from a listing
        the rep created. Computed once, when the retailer accepts delivery.
      </p>

      <div className="space-y-4">
        {reps.map(({ rep, commissions }) => {
          const totalOwed = commissions.reduce((sum, c) => sum + (c.status === "pending" ? c.amount : 0), 0);
          const totalPaid = commissions.reduce((sum, c) => sum + (c.status === "paid" ? c.amount : 0), 0);
          return (
            <div key={rep.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <h3 className="font-medium text-sm text-gray-900 dark:text-gray-100">
                    {rep.businessName ?? rep.fullName}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {commissions.length} sale{commissions.length === 1 ? "" : "s"} · ${totalOwed} pending · ${totalPaid} paid
                  </p>
                </div>
                <form action={setSalesRepRate} className="flex items-center gap-1">
                  <input type="hidden" name="userId" value={rep.id} />
                  <input
                    name="rate"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    defaultValue={rep.salesRepCommissionRate ?? ""}
                    placeholder="0"
                    className="w-16 border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1 text-xs bg-transparent"
                  />
                  <span className="text-xs text-gray-400">% rate</span>
                  <button type="submit" className="text-xs text-green-700 dark:text-green-400 underline">
                    Set
                  </button>
                </form>
              </div>

              {commissions.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 space-y-1">
                  {commissions.map((c) => (
                    <div key={c.id} className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-300">
                      <span>
                        {c.deal.thread.listing.strainName} — {c.rate}% of ${c.deal.finalPrice * c.deal.finalQuantity} = ${c.amount}
                      </span>
                      {c.status === "paid" ? (
                        <span className="text-green-700 dark:text-green-400">Paid</span>
                      ) : (
                        <form action={markSalesRepPaid}>
                          <input type="hidden" name="commissionId" value={c.id} />
                          <button type="submit" className="text-amber-700 dark:text-amber-400 underline">
                            Mark paid
                          </button>
                        </form>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {reps.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">No sales rep accounts yet.</p>}
      </div>
    </PortalShell>
  );
}
