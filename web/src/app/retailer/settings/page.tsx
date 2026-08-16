import { requireRole } from "@/lib/dal";
import { PortalShell } from "@/components/portal-shell";
import { MetrcSettings } from "@/components/metrc-settings";
import { connectMetrcAction, disconnectMetrcAction } from "./actions";

const NAV = [
  { href: "/retailer", label: "Browse inventory" },
  { href: "/retailer/negotiations", label: "My negotiations" },
  { href: "/retailer/watchlist", label: "Watchlist" },
  { href: "/retailer/requests", label: "Wanted board" },
  { href: "/retailer/settings", label: "Settings" },
];

export default async function RetailerSettingsPage() {
  const session = await requireRole("retailer");

  return (
    <PortalShell roleLabel="Retailer" navItems={NAV}>
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Settings</h1>
      <MetrcSettings userId={session.user.id} connectAction={connectMetrcAction} disconnectAction={disconnectMetrcAction} />
    </PortalShell>
  );
}
