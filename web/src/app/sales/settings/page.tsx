import { requireRole } from "@/lib/dal";
import { PortalShell } from "@/components/portal-shell";
import { ChangePasswordPanel } from "@/components/shared/change-password-panel";

const NAV = [
  { href: "/sales", label: "My accounts" },
  { href: "/sales/orders", label: "Orders" },
  { href: "/sales/negotiations", label: "Negotiations" },
  { href: "/sales/listings/new", label: "Post for a seller" },
  { href: "/sales/earnings", label: "My earnings" },
  { href: "/sales/marketing", label: "Marketing suite" },
  { href: "/sales/settings", label: "Settings" },
];

export default async function SalesSettingsPage() {
  await requireRole("sales_rep");

  return (
    <PortalShell roleLabel="Account Executive" navItems={NAV}>
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Settings</h1>
      <ChangePasswordPanel />
    </PortalShell>
  );
}
