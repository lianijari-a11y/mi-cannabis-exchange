import { requireRole } from "@/lib/dal";
import { PortalShell } from "@/components/portal-shell";
import { TransporterDashboard } from "@/components/transporter/transporter-dashboard";

const NAV = [{ href: "/transporter", label: "My shipments" }];

export default async function TransporterPage() {
  const session = await requireRole("transporter");

  return (
    <PortalShell roleLabel="Transporter" navItems={NAV}>
      <TransporterDashboard transporterId={session.user.id} />
    </PortalShell>
  );
}
