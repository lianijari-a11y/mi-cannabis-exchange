import { requireRole } from "@/lib/dal";
import { PortalShell } from "@/components/portal-shell";
import { pendingLicenseUsers, allUsers, licenseExpiryAlerts } from "@/lib/admin";
import { transporterRating, sellerRating, retailerRating } from "@/lib/market";
import { StateMarketWidget } from "@/components/state-market-widget";
import { ROLE_LABELS, type Role } from "@/lib/constants";
import { reviewLicense, togglePreferredTransporter, setSalesRepRate } from "./actions";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/listings", label: "All listings" },
  { href: "/admin/listings/new", label: "Post for a seller" },
  { href: "/admin/sales-reps", label: "Sales rep earnings" },
  { href: "/admin/data-uploads", label: "Data uploads" },
  { href: "/admin/metrc", label: "METRC" },
  { href: "/admin/marketing", label: "Marketing suite" },
];

export default async function AdminPage() {
  await requireRole("admin");
  const [pending, users, expiring] = await Promise.all([
    pendingLicenseUsers(),
    allUsers(),
    licenseExpiryAlerts(),
  ]);

  // "Who works best" across every role (CLAUDE.md §13) — same honesty rule
  // as the retailer-facing seller rating: no score until there's history.
  const ratings = await Promise.all(
    users.map((u) =>
      u.role === "transporter"
        ? transporterRating(u.id)
        : u.role === "retailer"
        ? retailerRating(u.id)
        : u.role === "grower" || u.role === "processor" || u.role === "broker"
        ? sellerRating(u.id)
        : Promise.resolve({ score: null, count: 0 })
    )
  );

  return (
    <PortalShell roleLabel="Admin" navItems={NAV}>
      <StateMarketWidget />
      <div className="space-y-8">
        {expiring.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
              License expiration alerts
            </h2>
            <div className="space-y-2">
              {expiring.map((user) => {
                const expired = (user.daysLeft ?? 0) < 0;
                return (
                  <div
                    key={user.id}
                    className={`rounded-xl p-3 flex items-center justify-between border ${
                      expired
                        ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900"
                        : "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-900"
                    }`}
                  >
                    <span className="text-sm text-gray-800 dark:text-gray-200">
                      {user.businessName ?? user.fullName}{" "}
                      <span className="text-xs text-gray-400">
                        ({ROLE_LABELS[user.role as Role] ?? user.role}) — {user.licenseNumber}
                      </span>
                    </span>
                    <span
                      className={`text-xs font-medium ${
                        expired
                          ? "text-red-600 dark:text-red-400"
                          : "text-amber-700 dark:text-amber-400"
                      }`}
                    >
                      {expired
                        ? `Expired ${Math.abs(user.daysLeft ?? 0)}d ago`
                        : `${user.daysLeft}d left`}{" "}
                      · {user.licenseExpiry?.toISOString().slice(0, 10)}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <section>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
            License verification queue
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            Growers, processors, and retailers can't post listings or make offers until their
            state license is approved.
          </p>

          {pending.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">Nothing pending review.</p>
          )}

          <div className="space-y-2">
            {pending.map((user) => (
              <div
                key={user.id}
                className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 flex items-center justify-between"
              >
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {user.businessName ?? user.fullName}{" "}
                    <span className="text-xs text-gray-400">
                      ({ROLE_LABELS[user.role as Role] ?? user.role})
                    </span>
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    License {user.licenseNumber ?? "—"}
                    {user.licenseType ? ` · ${user.licenseType}` : ""} · {user.email}
                  </p>
                </div>
                <div className="flex gap-2">
                  <form action={reviewLicense}>
                    <input type="hidden" name="userId" value={user.id} />
                    <input type="hidden" name="decision" value="approved" />
                    <button
                      type="submit"
                      className="bg-green-700 text-white rounded-lg px-3 py-1.5 text-xs font-medium"
                    >
                      Approve
                    </button>
                  </form>
                  <form action={reviewLicense}>
                    <input type="hidden" name="userId" value={user.id} />
                    <input type="hidden" name="decision" value="rejected" />
                    <button
                      type="submit"
                      className="border border-red-300 dark:border-red-800 text-red-600 rounded-lg px-3 py-1.5 text-xs font-medium"
                    >
                      Reject
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
            All users ({users.length})
          </h2>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Name</th>
                  <th className="text-left px-4 py-2 font-medium">Role</th>
                  <th className="text-left px-4 py-2 font-medium">License status</th>
                  <th className="text-left px-4 py-2 font-medium">Handle</th>
                  <th className="text-left px-4 py-2 font-medium">Rating</th>
                  <th className="text-left px-4 py-2 font-medium">Preferred</th>
                  <th className="text-left px-4 py-2 font-medium">Commission rate</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user, i) => (
                  <tr key={user.id} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="px-4 py-2 text-gray-900 dark:text-gray-100">
                      {user.businessName ?? user.fullName}
                    </td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-300">
                      {ROLE_LABELS[user.role as Role] ?? user.role}
                    </td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-300">
                      {user.licenseVerification}
                      {user.licenseVerification === "approved" && user.licenseAutoMatched && (
                        <span
                          className="ml-1.5 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                          title="Approved automatically by matching the license number against the state registry — not reviewed by an Admin. Matching a license number isn't proof of who's actually behind the account, so revoke this if anything looks off."
                        >
                          auto-matched
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-gray-400">{user.anonHandle}</td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-300">
                      {ratings[i].score != null ? `★ ${ratings[i].score} (${ratings[i].count})` : "—"}
                    </td>
                    <td className="px-4 py-2">
                      {user.role === "transporter" && (
                        <form action={togglePreferredTransporter}>
                          <input type="hidden" name="userId" value={user.id} />
                          <input
                            type="hidden"
                            name="preferred"
                            value={user.preferredTransporter ? "false" : "true"}
                          />
                          <button
                            type="submit"
                            className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full ${
                              user.preferredTransporter
                                ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                                : "border border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400"
                            }`}
                          >
                            {user.preferredTransporter ? "Preferred" : "Make preferred"}
                          </button>
                        </form>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {user.role === "sales_rep" && (
                        <form action={setSalesRepRate} className="flex items-center gap-1">
                          <input type="hidden" name="userId" value={user.id} />
                          <input
                            name="rate"
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            defaultValue={user.salesRepCommissionRate ?? ""}
                            placeholder="0"
                            className="w-14 border border-gray-300 dark:border-gray-700 rounded px-1 py-0.5 text-xs bg-transparent"
                          />
                          <span className="text-xs text-gray-400">%</span>
                          <button type="submit" className="text-[10px] text-green-700 dark:text-green-400 underline">
                            Set
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </PortalShell>
  );
}
