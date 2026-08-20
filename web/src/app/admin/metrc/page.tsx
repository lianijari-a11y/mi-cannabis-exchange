import { requireRole } from "@/lib/dal";
import { PortalShell } from "@/components/portal-shell";
import { metrcVendorConfig, allMetrcConnectionsForAdmin, recentSaleMetrcOutcomes } from "@/lib/metrc-integration";
import { ROLE_LABELS, type Role } from "@/lib/constants";
import { setMetrcVendorApiKeyAction, setMetrcUseSandboxAction } from "./actions";

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

export default async function AdminMetrcPage() {
  await requireRole("admin");
  const [vendorConfig, connections, saleOutcomes] = await Promise.all([
    metrcVendorConfig(),
    allMetrcConnectionsForAdmin(),
    recentSaleMetrcOutcomes(),
  ]);

  return (
    <PortalShell roleLabel="Admin" navItems={NAV}>
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
        Michigan METRC
      </h1>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-6 max-w-2xl">
        The Retailer Point of Sale register makes a real, live call to METRC&apos;s sales-receipts
        API on every sale (see CLAUDE.md §23) — Michigan requires seed-to-sale reporting for
        retail sales. Everywhere else in this app, METRC stays credential-storage only pending
        the still-open licensing question in §2; that's been explicitly set aside for POS.
      </p>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Platform developer API key
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 max-w-md">
          The software-vendor key METRC issues once this platform is a registered API
          integrator — used alongside each licensee&apos;s own key below.
        </p>
        <form action={setMetrcVendorApiKeyAction} className="flex gap-2 max-w-md">
          <input
            name="vendorApiKey"
            placeholder={vendorConfig?.vendorApiKey ? "Leave blank to keep current key" : "METRC Vendor API Key"}
            className="flex-1 border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1.5 text-xs bg-transparent"
          />
          <button type="submit" className="bg-green-700 text-white rounded-lg px-3 py-1.5 text-xs font-medium">
            Save
          </button>
        </form>
        {vendorConfig?.vendorApiKey && (
          <p className="text-[11px] text-gray-400 mt-1">
            Key on file ({vendorConfig.vendorApiKey}) — last updated{" "}
            {vendorConfig.updatedAt.toISOString().slice(0, 10)}
          </p>
        )}

        <form action={setMetrcUseSandboxAction} className="flex items-center gap-2 mt-4">
          <input
            type="checkbox"
            id="useSandbox"
            name="useSandbox"
            defaultChecked={vendorConfig?.useSandbox ?? true}
            className="rounded border-gray-300 dark:border-gray-700"
          />
          <label htmlFor="useSandbox" className="text-xs text-gray-700 dark:text-gray-300">
            Use METRC sandbox (not production) — leave checked until a real sale has been
            verified end-to-end
          </label>
          <button type="submit" className="text-[10px] text-green-700 dark:text-green-400 underline">
            Save
          </button>
        </form>
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Recent POS sale submissions
        </h2>
        {saleOutcomes.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No retail sale has attempted a METRC submission yet.
          </p>
        ) : (
          <div className="space-y-2">
            {saleOutcomes.map((s) => (
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
                <span
                  className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full ${
                    s.metrcStatus === "submitted"
                      ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                      : s.metrcStatus === "skipped_no_tag"
                      ? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                      : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                  }`}
                  title={s.metrcError ?? undefined}
                >
                  {s.metrcStatus.replace(/_/g, " ")}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Connected licensees ({connections.length})
        </h2>
        {connections.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No licensee has connected yet.</p>
        ) : (
          <div className="space-y-2">
            {connections.map((c) => (
              <div
                key={c.id}
                className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 flex items-center justify-between text-sm"
              >
                <span className="text-gray-900 dark:text-gray-100">
                  {c.user.businessName ?? c.user.fullName}{" "}
                  <span className="text-xs text-gray-400">({ROLE_LABELS[c.user.role as Role] ?? c.user.role})</span>
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  License {c.licenseNumber ?? "—"} · connected {c.connectedAt.toISOString().slice(0, 10)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </PortalShell>
  );
}
