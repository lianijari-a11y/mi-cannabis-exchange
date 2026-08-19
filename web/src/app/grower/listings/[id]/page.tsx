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
  { href: "/grower", label: "My listings" },
  { href: "/grower/listings/new", label: "Post inventory" },
  { href: "/grower/requests", label: "Buyer requests" },
  { href: "/grower/settings", label: "Settings" },
];

export default async function GrowerListingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireRole("grower");
  const { id } = await params;
  const { error } = await searchParams;

  return (
    <PortalShell roleLabel="Grower" navItems={NAV}>
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
