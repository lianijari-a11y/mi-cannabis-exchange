import Link from "next/link";
import { listingsForSeller } from "@/lib/listings";
import { groupListingsIntoMenus } from "@/lib/sales-actions";
import { MarketPulse } from "@/components/market-pulse";
import { StateMarketWidget } from "@/components/state-market-widget";
import { DashboardMenuGroup } from "@/components/seller/dashboard-menu-group";
import { CATEGORY_LABELS, TERMS_LABELS, type Category, type Terms } from "@/lib/constants";

export async function SellerDashboard({
  sellerId,
  basePath,
  bulkPhotoSaveAction,
  bulkPriceSaveAction,
}: {
  sellerId: string;
  basePath: string;
  bulkPhotoSaveAction?: (
    batchId: string,
    assignments: { listingId: string; url: string; contentType: string }[]
  ) => Promise<{ ok: true; savedCount: number } | { ok: false; error: string }>;
  bulkPriceSaveAction?: (
    batchId: string,
    adjustment: { mode: "percent" | "dollar" | "targetTotal"; value: number }
  ) => Promise<{ ok: true; updatedCount: number } | { ok: false; error: string }>;
}) {
  const listings = await listingsForSeller(sellerId);
  // Grouped into menus (CLAUDE.md §40's grouping, now here too) so a "Bulk
  // add photos" action has somewhere to live for a menu that's already
  // posted — "what if I made a menu without pictures, I'd need a new way
  // to upload pictures for menus that are already done."
  const menus = groupListingsIntoMenus(listings);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">My listings</h1>
        <Link
          href={`${basePath}/listings/new`}
          className="bg-green-700 text-white rounded-lg px-3 py-1.5 text-sm font-medium"
        >
          Post inventory
        </Link>
      </div>

      <StateMarketWidget />
      <MarketPulse />

      {listings.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No listings yet — post your first one to make it instantly visible to every retailer.
        </p>
      )}

      <div className="space-y-3">
        {menus.map((menu) => {
          const activeListings = menu.listings.filter((l) => l.status === "active");
          const activeCount = activeListings.length;
          const cardGrid = (
            <div className="grid sm:grid-cols-2 gap-3">
              {menu.listings.map((listing) => {
                const openThreads = listing.threads.filter((t) => t.status === "open").length;
                const staleDays = Math.floor(
                  (Date.now() - new Date(listing.lastConfirmedAt).getTime()) / (24 * 60 * 60 * 1000)
                );
                const isStale = listing.status === "active" && staleDays >= 3;
                return (
                  <Link
                    key={listing.id}
                    href={`${basePath}/listings/${listing.id}`}
                    className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 block hover:border-green-600"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-gray-100">
                          {listing.strainName}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {CATEGORY_LABELS[listing.category as Category] ?? listing.category}
                          {listing.thcPercent != null ? ` · ${listing.thcPercent}% THC` : ""}
                        </p>
                      </div>
                      <span
                        className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full ${
                          listing.status === "active"
                            ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                            : listing.status === "expired"
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                            : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                        }`}
                      >
                        {listing.status}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                      {listing.quantity} {listing.unit} · ${listing.pricePerUnit}/{listing.unit} ·{" "}
                      {TERMS_LABELS[listing.terms as Terms] ?? listing.terms}
                    </p>
                    {openThreads > 0 && (
                      <p className="mt-1 text-xs text-green-700 dark:text-green-400 font-medium">
                        {openThreads} open negotiation{openThreads > 1 ? "s" : ""}
                      </p>
                    )}
                    {isStale && (
                      <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                        Not confirmed available in {staleDays}d — open it to confirm
                      </p>
                    )}
                  </Link>
                );
              })}
            </div>
          );

          if (!bulkPhotoSaveAction || !bulkPriceSaveAction) return <div key={menu.batchId}>{cardGrid}</div>;

          return (
            <DashboardMenuGroup
              key={menu.batchId}
              batchId={menu.batchId}
              uploadedLabel={menu.createdAt.toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
              productCount={menu.listings.length}
              activeCount={activeCount}
              activeListings={activeListings.map((l) => ({
                id: l.id,
                strainName: l.strainName,
                pricePerUnit: l.pricePerUnit,
                quantity: l.quantity,
                unit: l.unit,
              }))}
              saveAction={bulkPhotoSaveAction}
              priceSaveAction={bulkPriceSaveAction}
              defaultOpen
            >
              {cardGrid}
            </DashboardMenuGroup>
          );
        })}
      </div>
    </div>
  );
}
