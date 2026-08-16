import Link from "next/link";
import { requireRole } from "@/lib/dal";
import { PortalShell } from "@/components/portal-shell";
import { threadsForRetailer } from "@/lib/offers";
import { TERMS_LABELS, type Terms } from "@/lib/constants";

const NAV = [
  { href: "/retailer", label: "Browse inventory" },
  { href: "/retailer/negotiations", label: "My negotiations" },
  { href: "/retailer/watchlist", label: "Watchlist" },
  { href: "/retailer/requests", label: "Wanted board" },
  { href: "/retailer/settings", label: "Settings" },
];

export default async function RetailerNegotiationsPage() {
  const session = await requireRole("retailer");
  const threads = await threadsForRetailer(session.user.id);

  return (
    <PortalShell roleLabel="Retailer" navItems={NAV}>
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        My negotiations
      </h1>

      {threads.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          You haven't made any offers yet.
        </p>
      )}

      <div className="space-y-3">
        {threads.map((thread) => (
          <Link
            key={thread.id}
            href={`/retailer/listings/${thread.listing.id}`}
            className="block bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 hover:border-green-600"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-medium text-gray-900 dark:text-gray-100">
                  {thread.listing.strainName}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {thread.listing.postedBy.anonHandle} · {thread.listing.quantity}{" "}
                  {thread.listing.unit} · ${thread.listing.pricePerUnit}/{thread.listing.unit} ·{" "}
                  {TERMS_LABELS[thread.listing.terms as Terms] ?? thread.listing.terms}
                </p>
              </div>
              <span
                className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full ${
                  thread.status === "open"
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400"
                    : thread.status === "accepted"
                    ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                    : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                }`}
              >
                {thread.status}
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-400">{thread.rounds.length} round(s)</p>
          </Link>
        ))}
      </div>
    </PortalShell>
  );
}
