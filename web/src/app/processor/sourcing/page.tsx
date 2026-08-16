import { requireRole } from "@/lib/dal";
import { PortalShell } from "@/components/portal-shell";
import { rawListingsForSourcing } from "@/lib/split-contracts";
import { ProposeSplitForm } from "@/components/processor/propose-split-form";
import { CATEGORY_LABELS, TERMS_LABELS, type Category, type Terms } from "@/lib/constants";
import { proposeSplit } from "./actions";

const NAV = [
  { href: "/processor", label: "My listings" },
  { href: "/processor/sourcing", label: "Sourcing" },
  { href: "/processor/contracts", label: "My contracts" },
  { href: "/processor/listings/new", label: "Post inventory" },
];

export default async function SourcingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireRole("processor");
  const { error } = await searchParams;
  const listings = await rawListingsForSourcing();

  return (
    <PortalShell roleLabel="Processor" navItems={NAV}>
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">Sourcing</h1>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
        Raw material listed by growers. Propose a toll-processing split instead of buying
        outright — you keep a % of the finished product's value instead of paying a flat price.
      </p>

      {error && <p className="text-xs text-red-600 mb-4">{error}</p>}

      {listings.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No active grower listings right now.
        </p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {listings.map((listing) => (
            <div
              key={listing.id}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-medium text-gray-900 dark:text-gray-100">
                  {listing.strainName}
                </h3>
                <span className="shrink-0 text-[10px] text-gray-400 border border-gray-200 dark:border-gray-700 rounded-full px-2 py-0.5">
                  {listing.postedBy.anonHandle}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {CATEGORY_LABELS[listing.category as Category] ?? listing.category}
                {listing.thcPercent != null ? ` · ${listing.thcPercent}% THC` : ""}
              </p>
              <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                {listing.quantity} {listing.unit} · ${listing.pricePerUnit}/{listing.unit} ·{" "}
                {TERMS_LABELS[listing.terms as Terms] ?? listing.terms}
              </p>
              <div className="mt-3">
                <ProposeSplitForm action={proposeSplit} listingId={listing.id} />
              </div>
            </div>
          ))}
        </div>
      )}
    </PortalShell>
  );
}
