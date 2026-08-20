import Link from "next/link";
import { requireRole } from "@/lib/dal";
import { PortalShell } from "@/components/portal-shell";
import { accountsForAdmin } from "@/lib/admin";
import { BroadcastMenusButton } from "@/components/sales/broadcast-menus-button";
import { ROLE_LABELS, type Role } from "@/lib/constants";
import { broadcastMenusToRetailersAction, broadcastMenusToProcessorsAction } from "./actions";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/listings", label: "All listings" },
  { href: "/admin/accounts", label: "Accounts" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/negotiations", label: "Negotiations" },
  { href: "/admin/listings/new", label: "Post for a seller" },
  { href: "/admin/staff/new", label: "Add staff account" },
  { href: "/admin/sales-reps", label: "Account Executive earnings" },
  { href: "/admin/data-uploads", label: "Data uploads" },
  { href: "/admin/metrc", label: "METRC" },
  { href: "/admin/system-health", label: "System health" },
  { href: "/admin/marketing", label: "Marketing suite" },
  { href: "/admin/settings", label: "Settings" },
];

// Admin's own version of the Account Executive's "/sales" landing page
// (CLAUDE.md §38/§39/§42) — every Grower/Processor platform-wide, not just
// accounts assigned to one rep, each with their whole menu grouped
// underneath. Admin already had a flat "All listings" view; this is the
// same account-grouped view an AE gets, plus the "more" Admin already has
// everywhere else in this app: no assignment restriction at all.
export default async function AdminAccountsPage() {
  await requireRole("admin");
  const accounts = await accountsForAdmin();

  return (
    <PortalShell roleLabel="Admin" navItems={NAV}>
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Accounts ({accounts.length})
        </h1>
        <div className="flex gap-2 flex-wrap">
          <Link
            href="/admin/collections/new"
            className="border border-green-700 text-green-700 dark:text-green-400 rounded-lg px-3 py-1.5 text-sm font-medium"
          >
            Share menus with a link
          </Link>
          <BroadcastMenusButton label="Share with all retailers" action={broadcastMenusToRetailersAction} />
          <BroadcastMenusButton label="Share with all processors" action={broadcastMenusToProcessorsAction} />
          <Link
            href="/admin/listings/new"
            className="bg-green-700 text-white rounded-lg px-3 py-1.5 text-sm font-medium"
          >
            Post for a seller
          </Link>
        </div>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        Every Grower/Processor on the platform, each with their whole menu grouped underneath —
        unlike an Account Executive&apos;s own accounts list, this isn&apos;t limited to sellers
        assigned to any one rep.
      </p>

      {accounts.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">No grower/processor accounts yet.</p>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        {accounts.map((a) => (
          <Link
            key={a.id}
            href={`/admin/accounts/${a.id}`}
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
                      : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                }`}
              >
                {a.licenseVerification}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {ROLE_LABELS[a.role as Role] ?? a.role} · {a._count.listings} listing
              {a._count.listings === 1 ? "" : "s"}
              {a.assignedSalesRep ? ` · Rep: ${a.assignedSalesRep.fullName}` : " · No rep assigned"}
            </p>
            <p className="text-xs text-gray-400 mt-1">{a.email}</p>
          </Link>
        ))}
      </div>
    </PortalShell>
  );
}
