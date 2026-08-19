import { requireRole } from "@/lib/dal";
import { PortalShell } from "@/components/portal-shell";
import { ListingForm } from "@/components/seller/listing-form";
import { SellerPickerOrCreate } from "@/components/sales/seller-picker-or-create";
import { createListingAsAdmin, createListingsBulkAsAdmin } from "./actions";
import { searchSellersAction } from "@/app/admin/search-action";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/listings", label: "All listings" },
  { href: "/admin/accounts", label: "Accounts" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/negotiations", label: "Negotiations" },
  { href: "/admin/listings/new", label: "Post for a seller" },
  { href: "/admin/staff/new", label: "Add staff account" },
  { href: "/admin/sales-reps", label: "Account Executive earnings" },
  { href: "/admin/data-uploads", label: "Data uploads" },
  { href: "/admin/metrc", label: "METRC" },
  { href: "/admin/system-health", label: "System health" },
  { href: "/admin/marketing", label: "Marketing suite" },
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
        Same tool the Account Executive role uses — posts under the chosen grower/processor's own
        identity.
      </p>
      <ListingForm
        action={createListingAsAdmin}
        bulkAction={createListingsBulkAsAdmin}
        error={error}
        sellerPickerSlot={<SellerPickerOrCreate searchAction={searchSellersAction} />}
      />
    </PortalShell>
  );
}
