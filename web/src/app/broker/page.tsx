import { requireRole } from "@/lib/dal";
import { PortalShell } from "@/components/portal-shell";
import { BrokerDashboard } from "@/components/broker/broker-dashboard";

const NAV = [
  { href: "/broker", label: "All negotiations" },
  { href: "/broker/listings/new", label: "Post inventory" },
];

export default async function BrokerPage() {
  await requireRole("broker");

  return (
    <PortalShell roleLabel="Broker" navItems={NAV}>
      <BrokerDashboard />
    </PortalShell>
  );
}
