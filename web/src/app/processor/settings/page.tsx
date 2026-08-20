import { requireRole } from "@/lib/dal";
import { PortalShell } from "@/components/portal-shell";
import { PosSettings } from "@/components/seller/pos-settings";
import { MetrcSettings } from "@/components/metrc-settings";
import { ChangePasswordPanel } from "@/components/shared/change-password-panel";
import {
  connectPosAction,
  disconnectPosAction,
  connectMetrcAction,
  disconnectMetrcAction,
} from "./actions";

const NAV = [
  { href: "/processor", label: "My listings" },
  { href: "/processor/sourcing", label: "Sourcing" },
  { href: "/processor/contracts", label: "My contracts" },
  { href: "/processor/listings/new", label: "Post inventory" },
  { href: "/processor/requests", label: "Buyer requests" },
  { href: "/processor/settings", label: "Settings" },
];

export default async function ProcessorSettingsPage() {
  const session = await requireRole("processor");

  return (
    <PortalShell roleLabel="Processor" navItems={NAV}>
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Settings</h1>
      <div className="space-y-4">
        <MetrcSettings userId={session.user.id} connectAction={connectMetrcAction} disconnectAction={disconnectMetrcAction} />
        <PosSettings sellerId={session.user.id} connectAction={connectPosAction} disconnectAction={disconnectPosAction} />
        <ChangePasswordPanel />
      </div>
    </PortalShell>
  );
}
