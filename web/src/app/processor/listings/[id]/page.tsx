import { requireRole } from "@/lib/dal";
import { PortalShell } from "@/components/portal-shell";
import { SellerListingDetail } from "@/components/seller/listing-detail";
import {
  respond,
  uploadInvoice,
  splitContractRespond,
  confirmListingFresh,
  acceptShipmentSchedule,
  setPickupInstructions,
  acceptRejectionCounter,
  requireReturnInsteadOfCounter,
  editListing,
} from "./actions";

const NAV = [
  { href: "/processor", label: "My listings" },
  { href: "/processor/sourcing", label: "Sourcing" },
  { href: "/processor/contracts", label: "My contracts" },
  { href: "/processor/listings/new", label: "Post inventory" },
  { href: "/processor/requests", label: "Buyer requests" },
  { href: "/processor/settings", label: "Settings" },
];

export default async function ProcessorListingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireRole("processor");
  const { id } = await params;
  const { error } = await searchParams;

  return (
    <PortalShell roleLabel="Processor" navItems={NAV}>
      <SellerListingDetail
        listingId={id}
        sellerId={session.user.id}
        respondAction={respond}
        invoiceAction={uploadInvoice}
        splitContractRespondAction={splitContractRespond}
        confirmFreshAction={confirmListingFresh}
        acceptScheduleAction={acceptShipmentSchedule}
        setPickupInstructionsAction={setPickupInstructions}
        acceptRejectionCounterAction={acceptRejectionCounter}
        requireReturnAction={requireReturnInsteadOfCounter}
        editAction={editListing}
        editError={error ? decodeURIComponent(error) : undefined}
      />
    </PortalShell>
  );
}
