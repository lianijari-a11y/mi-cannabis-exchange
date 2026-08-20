import Link from "next/link";
import { requireRole } from "@/lib/dal";
import { PortalShell } from "@/components/portal-shell";
import { allListingsForAdmin, retailersForPicker } from "@/lib/admin";
import { ListingVisibilityForm } from "@/components/admin/listing-visibility-form";
import { ShareListingLink } from "@/components/seller/share-listing-link";
import { CATEGORY_LABELS, type Category } from "@/lib/constants";
import { updateListingVisibility } from "./actions";

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
  { href: "/admin/settings", label: "Settings" },
];

export default async function AdminListingsPage() {
  await requireRole("admin");
  const [listings, retailers] = await Promise.all([allListingsForAdmin(), retailersForPicker()]);

  return (
    <PortalShell roleLabel="Admin" navItems={NAV}>
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">All listings</h1>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
        By default every active listing is visible to every retailer. Restricting a listing to
        specific retailers is a deliberate reversal of that default — see CLAUDE.md §18.
      </p>

      <div className="space-y-3">
        {listings.map((l) => (
          <div key={l.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <h3 className="font-medium text-sm text-gray-900 dark:text-gray-100">{l.strainName}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {CATEGORY_LABELS[l.category as Category] ?? l.category} · posted by{" "}
                  {l.postedBy.businessName ?? l.postedBy.fullName} ({l.postedBy.role}) · {l.status}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {l.status === "active" && (
                  <Link
                    href={`/admin/listings/${l.id}`}
                    className="text-xs text-green-700 dark:text-green-400 underline"
                  >
                    Edit
                  </Link>
                )}
                <span
                  className={`text-[10px] rounded-full px-2 py-0.5 border ${
                    l.visibility === "all"
                      ? "text-gray-500 border-gray-200 dark:border-gray-700"
                      : "text-amber-700 border-amber-300 dark:border-amber-800"
                  }`}
                >
                  {l.visibility === "all" ? "All retailers" : `Exclusive (${l.exclusiveRetailerIds.length})`}
                </span>
              </div>
            </div>
            <ListingVisibilityForm
              listingId={l.id}
              currentVisibility={l.visibility}
              currentExclusiveIds={l.exclusiveRetailerIds}
              retailers={retailers}
              action={updateListingVisibility}
            />
            {l.status === "active" && l.visibility === "all" && <ShareListingLink listingId={l.id} />}
          </div>
        ))}
        {listings.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">No listings yet.</p>}
      </div>
    </PortalShell>
  );
}
