import { requireRole } from "@/lib/dal";
import { PortalShell } from "@/components/portal-shell";
import { openProductRequestsForSuppliers } from "@/lib/product-requests";
import { listingsForSeller } from "@/lib/listings";
import { RequestBoard } from "@/components/requests/request-board";
import { respondToRequest } from "./actions";

const NAV = [
  { href: "/grower", label: "My listings" },
  { href: "/grower/listings/new", label: "Post inventory" },
  { href: "/grower/requests", label: "Buyer requests" },
  { href: "/grower/settings", label: "Settings" },
];

export default async function GrowerRequestsPage() {
  const session = await requireRole("grower");
  const [requests, myListings] = await Promise.all([
    openProductRequestsForSuppliers(),
    listingsForSeller(session.user.id),
  ]);

  return (
    <PortalShell roleLabel="Grower" navItems={NAV}>
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">Buyer requests</h1>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
        Retailers post what they need here when nothing in the feed matches. Respond with a price
        and, if you have one, link a matching active listing.
      </p>
      <RequestBoard
        requests={requests}
        myListings={myListings.filter((l) => l.status === "active").map((l) => ({ id: l.id, strainName: l.strainName }))}
        respondAction={respondToRequest}
      />
    </PortalShell>
  );
}
