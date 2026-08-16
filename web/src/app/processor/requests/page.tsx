import { requireRole } from "@/lib/dal";
import { PortalShell } from "@/components/portal-shell";
import { openProductRequestsForSuppliers } from "@/lib/product-requests";
import { listingsForSeller } from "@/lib/listings";
import { RequestBoard } from "@/components/requests/request-board";
import { respondToRequest } from "./actions";

const NAV = [
  { href: "/processor", label: "My listings" },
  { href: "/processor/sourcing", label: "Sourcing" },
  { href: "/processor/contracts", label: "My contracts" },
  { href: "/processor/listings/new", label: "Post inventory" },
  { href: "/processor/requests", label: "Buyer requests" },
  { href: "/processor/settings", label: "Settings" },
];

export default async function ProcessorRequestsPage() {
  const session = await requireRole("processor");
  const [requests, myListings] = await Promise.all([
    openProductRequestsForSuppliers(),
    listingsForSeller(session.user.id),
  ]);

  return (
    <PortalShell roleLabel="Processor" navItems={NAV}>
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
