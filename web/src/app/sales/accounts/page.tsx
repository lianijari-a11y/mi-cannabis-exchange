import Link from "next/link";
import { requireRole } from "@/lib/dal";
import { PortalShell } from "@/components/portal-shell";
import { accountsForSalesRep } from "@/lib/sales-actions";
import { ROLE_LABELS, type Role } from "@/lib/constants";

const NAV = [
  { href: "/sales", label: "My activity" },
  { href: "/sales/accounts", label: "My accounts" },
  { href: "/sales/listings/new", label: "Post for a seller" },
  { href: "/sales/earnings", label: "My earnings" },
  { href: "/sales/marketing", label: "Marketing suite" },
];

// The account-centric view CLAUDE.md §38 asked for: every grower/processor
// currently assigned to this rep, one row per business — not a flat feed of
// individual strain listings. Click into one to see/edit their whole menu.
export default async function SalesAccountsPage() {
  const session = await requireRole("sales_rep");
  const accounts = await accountsForSalesRep(session.user.id);

  return (
    <PortalShell roleLabel="Account Executive" navItems={NAV}>
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">My accounts</h1>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
        Every grower/processor you&apos;re working with — once you post a listing or create an
        account for one, it&apos;s dedicated to you; no other Account Executive can post or edit for
        them after that.
      </p>

      {accounts.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No accounts yet. Post a listing for a seller, or create a new account from their license
          number, and it&apos;ll show up here.
        </p>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        {accounts.map((a) => (
          <Link
            key={a.id}
            href={`/sales/accounts/${a.id}`}
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 hover:border-green-300 dark:hover:border-green-800"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-medium text-gray-900 dark:text-gray-100">
                {a.businessName ?? a.fullName}
              </h3>
              <span
                className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0 ${
                  a.licenseVerification === "approved"
                    ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                    : a.licenseVerification === "rejected"
                    ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                }`}
              >
                {a.licenseVerification}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {ROLE_LABELS[a.role as Role] ?? a.role} · {a.email}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {a._count.listings} listing{a._count.listings === 1 ? "" : "s"} total
            </p>
          </Link>
        ))}
      </div>
    </PortalShell>
  );
}
