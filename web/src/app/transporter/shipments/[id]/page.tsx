import { requireRole } from "@/lib/dal";
import { PortalShell } from "@/components/portal-shell";
import { TransporterShipmentDetail } from "@/components/transporter/shipment-detail";
import { advanceStatus } from "./actions";

const NAV = [{ href: "/transporter", label: "My shipments" }];

export default async function TransporterShipmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireRole("transporter");
  const { id } = await params;

  return (
    <PortalShell roleLabel="Transporter" navItems={NAV}>
      <TransporterShipmentDetail
        shipmentId={id}
        transporterId={session.user.id}
        advanceAction={advanceStatus}
      />
    </PortalShell>
  );
}
