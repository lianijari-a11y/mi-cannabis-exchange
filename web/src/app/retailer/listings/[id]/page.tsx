import { requireRole } from "@/lib/dal";
import { PortalShell } from "@/components/portal-shell";
import { RetailerListingDetail } from "@/components/retailer/retailer-listing-detail";
import { respond, acceptInvoice, acceptProduct, rejectProduct } from "./actions";

const NAV = [
  { href: "/retailer", label: "Browse inventory" },
  { href: "/retailer/negotiations", label: "My negotiations" },
  { href: "/retailer/watchlist", label: "Watchlist" },
];

export default async function RetailerListingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireRole("retailer");
  const { id } = await params;
  const { error } = await searchParams;

  return (
    <PortalShell roleLabel="Retailer" navItems={NAV}>
      <RetailerListingDetail
        listingId={id}
        retailerId={session.user.id}
        respondAction={respond}
        acceptInvoiceAction={acceptInvoice}
        acceptProductAction={acceptProduct}
        rejectProductAction={rejectProduct}
        error={error}
      />
    </PortalShell>
  );
}
