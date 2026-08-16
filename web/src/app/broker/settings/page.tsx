import { requireRole } from "@/lib/dal";
import { PortalShell } from "@/components/portal-shell";
import { PosSettings } from "@/components/seller/pos-settings";
import { connectPosAction, disconnectPosAction } from "./actions";

const NAV = [
  { href: "/broker", label: "All negotiations" },
  { href: "/broker/listings/new", label: "Post inventory" },
  { href: "/broker/requests", label: "Buyer requests" },
  { href: "/broker/settings", label: "Settings" },
];

export default async function BrokerSettingsPage() {
  const session = await requireRole("broker");

  return (
    <PortalShell roleLabel="Broker" navItems={NAV}>
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Settings</h1>
      <PosSettings sellerId={session.user.id} connectAction={connectPosAction} disconnectAction={disconnectPosAction} />
    </PortalShell>
  );
}
