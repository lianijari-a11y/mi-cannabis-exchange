import { requireRole } from "@/lib/dal";
import { PortalShell } from "@/components/portal-shell";
import { SellerListingDetail } from "@/components/seller/listing-detail";
import { respond, uploadInvoice, splitContractRespond } from "./actions";

const NAV = [
  { href: "/grower", label: "My listings" },
  { href: "/grower/listings/new", label: "Post inventory" },
];

export default async function GrowerListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireRole("grower");
  const { id } = await params;

  return (
    <PortalShell roleLabel="Grower" navItems={NAV}>
      <SellerListingDetail
        listingId={id}
        sellerId={session.user.id}
        respondAction={respond}
        invoiceAction={uploadInvoice}
        splitContractRespondAction={splitContractRespond}
      />
    </PortalShell>
  );
}
