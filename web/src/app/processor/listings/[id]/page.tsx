import { requireRole } from "@/lib/dal";
import { PortalShell } from "@/components/portal-shell";
import { SellerListingDetail } from "@/components/seller/listing-detail";
import { respond, uploadInvoice } from "./actions";

const NAV = [
  { href: "/processor", label: "My listings" },
  { href: "/processor/listings/new", label: "Post inventory" },
];

export default async function ProcessorListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireRole("processor");
  const { id } = await params;

  return (
    <PortalShell roleLabel="Processor" navItems={NAV}>
      <SellerListingDetail
        listingId={id}
        sellerId={session.user.id}
        respondAction={respond}
        invoiceAction={uploadInvoice}
      />
    </PortalShell>
  );
}
