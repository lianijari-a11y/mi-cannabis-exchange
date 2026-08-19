import Link from "next/link";
import { requireRole } from "@/lib/dal";
import { PortalShell } from "@/components/portal-shell";
import { accountsForSalesRep } from "@/lib/sales-actions";
import { StateMarketWidget } from "@/components/state-market-widget";
import { ResetPasswordPanel } from "@/components/sales/reset-password-panel";
import { ROLE_LABELS, type Role } from "@/lib/constants";

const NAV = [
  { href: "/sales", label: "My accounts" },
  { href: "/sales/listings/new", label: "Post for a seller" },
  { href: "/sales/earnings", label: "My earnings" },
  { href: "/sales/marketing", label: "Marketing suite" },
];

// The AE's landing page — one row per grower/processor assigned to them,
// each with their whole menu grouped underneath (click in to see/edit it).
// This used to be a flat, ungrouped feed of individual strain listings with
// no sense of which grower they belonged to; that was the actual gap
// CLAUDE.md §38 was raised about, so this page itself is now the account
// list rather than a separate "My accounts" tab off to the side.
export default async function SalesRepPage() {
  const session = await requireRole("sales_rep");
  const accounts = await accountsForSalesRep(session.user.id);

  return (
    <PortalShell roleLabel="Account Executive" navItems={NAV}>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">My accounts</h1>
        <Link
          href="/sales/listings/new"
          className="bg-green-700 text-white rounded-lg px-3 py-1.5 text-sm font-medium"
        >
          Post for a seller
        </Link>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        Every grower/processor you&apos;re working with, each with their whole menu grouped
        underneath — once you post a listing or create an account for one, it&apos;s dedicated to
        you; no other Account Executive can post or edit for them after that.
      </p>

      <StateMarketWidget />

      <div className="my-6">
        <ResetPasswordPanel />
      </div>

      {accounts.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No accounts yet. Post a listing for a seller, or create a new account from their license
          number, and it&apos;ll show up here with their full menu grouped underneath.
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
              {a._count.listings} listing{a._count.listings === 1 ? "" : "s"} in their menu
            </p>
          </Link>
        ))}
      </div>
    </PortalShell>
  );
}
