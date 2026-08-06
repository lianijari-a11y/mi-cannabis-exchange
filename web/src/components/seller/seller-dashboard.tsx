import Link from "next/link";
import { listingsForSeller } from "@/lib/listings";
import { CATEGORY_LABELS, TERMS_LABELS, type Category, type Terms } from "@/lib/constants";

export async function SellerDashboard({
  sellerId,
  basePath,
}: {
  sellerId: string;
  basePath: string;
}) {
  const listings = await listingsForSeller(sellerId);

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

      {listings.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No listings yet — post your first one to make it instantly visible to every retailer.
        </p>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        {listings.map((listing) => {
          const openThreads = listing.threads.filter((t) => t.status === "open").length;
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
            </Link>
          );
        })}
      </div>
    </div>
  );
}
