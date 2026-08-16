import Link from "next/link";
import { requireRole } from "@/lib/dal";
import { PortalShell } from "@/components/portal-shell";
import { listingsCreatedByAssistant } from "@/lib/sales-actions";
import { StateMarketWidget } from "@/components/state-market-widget";
import { CATEGORY_LABELS, type Category } from "@/lib/constants";

const NAV = [
  { href: "/sales", label: "My activity" },
  { href: "/sales/listings/new", label: "Post for a seller" },
  { href: "/sales/earnings", label: "My earnings" },
  { href: "/sales/marketing", label: "Marketing suite" },
];

export default async function SalesRepPage() {
  const session = await requireRole("sales_rep");
  const listings = await listingsCreatedByAssistant(session.user.id);

  return (
    <PortalShell roleLabel="Sales Rep" navItems={NAV}>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Listings you've posted
        </h1>
        <Link
          href="/sales/listings/new"
          className="bg-green-700 text-white rounded-lg px-3 py-1.5 text-sm font-medium"
        >
          Post for a seller
        </Link>
      </div>

      <StateMarketWidget />

      {listings.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Nothing posted yet. Solicit an inventory list from a grower or processor, then build it
          into a listing under their profile.
        </p>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        {listings.map((listing) => (
          <div
            key={listing.id}
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4"
          >
            <div className="flex items-start justify-between">
              <h3 className="font-medium text-gray-900 dark:text-gray-100">{listing.strainName}</h3>
              <span
                className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full ${
                  listing.status === "active"
                    ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                    : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                }`}
              >
                {listing.status}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {CATEGORY_LABELS[listing.category as Category] ?? listing.category} ·{" "}
              {listing.postedBy.businessName ?? listing.postedBy.fullName} ({listing.postedBy.role})
            </p>
            <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
              {listing.quantity} {listing.unit} · ${listing.pricePerUnit}/{listing.unit}
            </p>
          </div>
        ))}
      </div>
    </PortalShell>
  );
}
