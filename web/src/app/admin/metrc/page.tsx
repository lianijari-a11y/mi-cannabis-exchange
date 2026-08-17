import { requireRole } from "@/lib/dal";
import { PortalShell } from "@/components/portal-shell";
import { metrcVendorConfig, allMetrcConnectionsForAdmin } from "@/lib/metrc-integration";
import { ROLE_LABELS, type Role } from "@/lib/constants";
import { setMetrcVendorApiKeyAction } from "./actions";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/listings", label: "All listings" },
  { href: "/admin/listings/new", label: "Post for a seller" },
  { href: "/admin/staff/new", label: "Add staff account" },
  { href: "/admin/sales-reps", label: "Sales rep earnings" },
  { href: "/admin/data-uploads", label: "Data uploads" },
  { href: "/admin/metrc", label: "METRC" },
  { href: "/admin/marketing", label: "Marketing suite" },
];

export default async function AdminMetrcPage() {
  await requireRole("admin");
  const [vendorConfig, connections] = await Promise.all([
    metrcVendorConfig(),
    allMetrcConnectionsForAdmin(),
  ]);

  return (
    <PortalShell roleLabel="Admin" navItems={NAV}>
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
        Michigan METRC
      </h1>
      <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900 rounded-lg p-2 mb-6 max-w-2xl">
        Scaffolding only — no live METRC API calls happen anywhere in this app yet. This page
        stores credentials so the connection is ready the moment real API access is confirmed
        and the licensing question in CLAUDE.md §2 (whether Broker is a recognized license
        category for wholesale transfers) has been reviewed.
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
            placeholder="METRC Vendor API Key"
            defaultValue={vendorConfig?.vendorApiKey ?? ""}
            className="flex-1 border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1.5 text-xs bg-transparent"
          />
          <button type="submit" className="bg-green-700 text-white rounded-lg px-3 py-1.5 text-xs font-medium">
            Save
          </button>
        </form>
        {vendorConfig?.vendorApiKey && (
          <p className="text-[11px] text-gray-400 mt-1">
            Last updated {vendorConfig.updatedAt.toISOString().slice(0, 10)}
          </p>
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
