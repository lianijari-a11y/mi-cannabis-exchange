import { requireRole } from "@/lib/dal";
import { PortalShell } from "@/components/portal-shell";
import { activeListingsFeed } from "@/lib/listings";
import { ListingCard } from "@/components/retailer/listing-card";
import { MarketPulse } from "@/components/market-pulse";
import { watchlistedIdsFor } from "@/lib/watchlist";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/constants";

const NAV = [
  { href: "/retailer", label: "Browse inventory" },
  { href: "/retailer/negotiations", label: "My negotiations" },
  { href: "/retailer/watchlist", label: "Watchlist" },
];

const SORTS = {
  newest: "Newest",
  price_asc: "Price: low to high",
  price_desc: "Price: high to low",
  thc_desc: "THC: high to low",
} as const;

export default async function RetailerPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; sort?: string }>;
}) {
  const session = await requireRole("retailer");
  const { category, sort } = await searchParams;
  let listings = await activeListingsFeed();
  const watchlistIds = await watchlistedIdsFor(session.user.id);

  if (category && CATEGORIES.includes(category as (typeof CATEGORIES)[number])) {
    listings = listings.filter((l) => l.category === category);
  }

  switch (sort) {
    case "price_asc":
      listings = [...listings].sort((a, b) => a.pricePerUnit - b.pricePerUnit);
      break;
    case "price_desc":
      listings = [...listings].sort((a, b) => b.pricePerUnit - a.pricePerUnit);
      break;
    case "thc_desc":
      listings = [...listings].sort((a, b) => (b.thcPercent ?? 0) - (a.thcPercent ?? 0));
      break;
    default:
      break;
  }

  return (
    <PortalShell roleLabel="Retailer" navItems={NAV}>
      <div className="flex items-start justify-between flex-wrap gap-3 mb-1">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Available inventory
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Every poster is shown as an anonymous handle — identities are never revealed between
            buyer and seller.
          </p>
        </div>

        <form className="flex gap-2 text-xs">
          <select
            name="category"
            defaultValue={category ?? ""}
            className="border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-transparent"
          >
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
          <select
            name="sort"
            defaultValue={sort ?? "newest"}
            className="border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-transparent"
          >
            {Object.entries(SORTS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="bg-green-700 text-white rounded-lg px-3 py-1.5 font-medium"
          >
            Apply
          </button>
        </form>
      </div>

      <MarketPulse />

      {listings.length === 0 && (
        <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
          No listings match right now — check back soon.
        </p>
      )}

      <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {listings.map((listing) => (
          <ListingCard key={listing.id} listing={listing} watching={watchlistIds.has(listing.id)} />
        ))}
      </div>
    </PortalShell>
  );
}
