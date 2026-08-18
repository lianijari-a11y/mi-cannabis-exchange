import { requireRole } from "@/lib/dal";
import { PortalShell } from "@/components/portal-shell";
import { ListingForm } from "@/components/seller/listing-form";
import { SellerPickerOrCreate } from "@/components/sales/seller-picker-or-create";
import { createListingAsSalesRep, createListingsBulkAsSalesRep } from "./actions";
import { searchSellersAction } from "@/app/sales/search-action";

const NAV = [
  { href: "/sales", label: "My activity" },
  { href: "/sales/listings/new", label: "Post for a seller" },
  { href: "/sales/earnings", label: "My earnings" },
  { href: "/sales/marketing", label: "Marketing suite" },
];

export default async function NewSalesRepListingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireRole("sales_rep");
  const { error } = await searchParams;

  return (
    <PortalShell roleLabel="Account Executive" navItems={NAV}>
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
        Post inventory for a seller
      </h1>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        Build the listing from whatever the grower/processor sent you — it posts under their own
        identity, exactly as if they'd posted it themselves.
      </p>
      <ListingForm
        action={createListingAsSalesRep}
        bulkAction={createListingsBulkAsSalesRep}
        error={error}
        sellerPickerSlot={<SellerPickerOrCreate searchAction={searchSellersAction} />}
      />
    </PortalShell>
  );
}
