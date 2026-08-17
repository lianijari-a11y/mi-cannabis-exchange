import { requireRole } from "@/lib/dal";
import { PortalShell } from "@/components/portal-shell";
import { watchlistedListings } from "@/lib/watchlist";
import { ListingCard } from "@/components/retailer/listing-card";

const NAV = [
  { href: "/retailer", label: "Browse inventory" },
  { href: "/retailer/negotiations", label: "My negotiations" },
  { href: "/retailer/watchlist", label: "Watchlist" },
  { href: "/retailer/requests", label: "Wanted board" },
  { href: "/retailer/pos", label: "Point of sale" },
  { href: "/retailer/settings", label: "Settings" },
];

export default async function WatchlistPage() {
  const session = await requireRole("retailer");
  const listings = await watchlistedListings(session.user.id);

  return (
    <PortalShell roleLabel="Retailer" navItems={NAV}>
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">Watchlist</h1>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
        Listings you're tracking. Only active listings show up here.
      </p>

      {listings.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Nothing watched yet — tap the eye icon on any listing to track it here.
        </p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} watching />
          ))}
        </div>
      )}
    </PortalShell>
  );
}
