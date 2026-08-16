import { requireRole } from "@/lib/dal";
import { PortalShell } from "@/components/portal-shell";
import { TransporterShipmentDetail } from "@/components/transporter/shipment-detail";
import {
  advanceStatus,
  proposeSchedule,
  submitTransportFee,
  submitTransportInvoice,
  confirmTransportFeePaid,
} from "./actions";

const NAV = [
  { href: "/transporter", label: "My shipments" },
  { href: "/transporter/settings", label: "Settings" },
];

export default async function TransporterShipmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireRole("transporter");
  const { id } = await params;
  const { error } = await searchParams;

  return (
    <PortalShell roleLabel="Transporter" navItems={NAV}>
      <TransporterShipmentDetail
        shipmentId={id}
        transporterId={session.user.id}
        advanceAction={advanceStatus}
        proposeScheduleAction={proposeSchedule}
        transportFeeAction={submitTransportFee}
        transportInvoiceAction={submitTransportInvoice}
        confirmTransportFeePaidAction={confirmTransportFeePaid}
        error={error}
      />
    </PortalShell>
  );
}
