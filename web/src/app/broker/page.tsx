import { requireRole } from "@/lib/dal";
import { PortalShell } from "@/components/portal-shell";
import { BrokerDashboard } from "@/components/broker/broker-dashboard";
import { StateMarketWidget } from "@/components/state-market-widget";
import { setCommissionAction, markCommissionPaidAction } from "./actions";

const NAV = [
  { href: "/broker", label: "All negotiations" },
  { href: "/broker/listings/new", label: "Post inventory" },
  { href: "/broker/requests", label: "Buyer requests" },
  { href: "/broker/settings", label: "Settings" },
];

export default async function BrokerPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireRole("broker");
  const { error } = await searchParams;

  return (
    <PortalShell roleLabel="Broker" navItems={NAV}>
      {error && <p className="text-xs text-red-600 mb-4">{error}</p>}
      <StateMarketWidget />
      <BrokerDashboard
        setCommissionAction={setCommissionAction}
        markCommissionPaidAction={markCommissionPaidAction}
      />
    </PortalShell>
  );
}
