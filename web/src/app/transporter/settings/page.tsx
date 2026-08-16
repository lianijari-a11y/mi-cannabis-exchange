import { requireRole } from "@/lib/dal";
import { PortalShell } from "@/components/portal-shell";
import { MetrcSettings } from "@/components/metrc-settings";
import { connectMetrcAction, disconnectMetrcAction } from "./actions";

const NAV = [
  { href: "/transporter", label: "My shipments" },
  { href: "/transporter/settings", label: "Settings" },
];

export default async function TransporterSettingsPage() {
  const session = await requireRole("transporter");

  return (
    <PortalShell roleLabel="Transporter" navItems={NAV}>
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Settings</h1>
      <MetrcSettings userId={session.user.id} connectAction={connectMetrcAction} disconnectAction={disconnectMetrcAction} />
    </PortalShell>
  );
}
