import { requireRole } from "@/lib/dal";
import { PortalShell } from "@/components/portal-shell";
import { ListingForm } from "@/components/seller/listing-form";
import { SellerPicker } from "@/components/sales/seller-picker";
import { createListingAsAdmin } from "./actions";
import { searchSellersAction } from "@/app/admin/search-action";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/listings", label: "All listings" },
  { href: "/admin/listings/new", label: "Post for a seller" },
  { href: "/admin/sales-reps", label: "Sales rep earnings" },
  { href: "/admin/data-uploads", label: "Data uploads" },
  { href: "/admin/metrc", label: "METRC" },
];

export default async function NewAdminListingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireRole("admin");
  const { error } = await searchParams;

  return (
    <PortalShell roleLabel="Admin" navItems={NAV}>
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
        Post inventory for a seller
      </h1>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        Same tool the Sales Rep role uses — posts under the chosen grower/processor's own
        identity.
      </p>
      <ListingForm
        action={createListingAsAdmin}
        error={error}
        sellerPickerSlot={<SellerPicker searchAction={searchSellersAction} />}
      />
    </PortalShell>
  );
}
