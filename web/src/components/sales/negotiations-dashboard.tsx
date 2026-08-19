import { TERMS_LABELS, type Terms } from "@/lib/constants";

type Thread = {
  id: string;
  status: string;
  updatedAt: Date;
  listing: {
    strainName: string;
    unit: string;
    postedBy: { businessName: string | null; fullName: string; licenseNumber: string | null };
  };
  retailer: { businessName: string | null; fullName: string; licenseNumber: string | null };
  rounds: {
    id: string;
    actorRole: string;
    action: string;
    price: number | null;
    terms: string | null;
  }[];
  deal: { id: string; finalPrice: number; finalQuantity: number } | null;
};

const STATUS_STYLE: Record<string, string> = {
  open: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  accepted: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
  rejected: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
};

// An Account Executive's own negotiations view (CLAUDE.md — a deliberate,
// confirmed reversal of the blind-marketplace boundary for this role
// specifically) — real identity on both sides, but scoped to threads on
// listings from this rep's own assigned accounts, not platform-wide.
// Shares its row layout with the Broker dashboard's own negotiations
// section on purpose, since it's the same underlying data just filtered
// down — Admin's equivalent page reuses allThreadsForBroker() directly and
// renders through this exact same component, unscoped.
export function NegotiationsDashboard({ threads, scopeLabel }: { threads: Thread[]; scopeLabel: string }) {
  const open = threads.filter((t) => t.status === "open");
  const closed = threads.filter((t) => t.status !== "open");

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">Negotiations</h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          {scopeLabel} — {open.length} open.
        </p>

        {open.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">No open negotiations.</p>}

        <div className="space-y-3">
          {open.map((thread) => (
            <div
              key={thread.id}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4"
            >
              <div className="flex items-start justify-between mb-1">
                <h3 className="font-medium text-gray-900 dark:text-gray-100">{thread.listing.strainName}</h3>
                <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full ${STATUS_STYLE.open}`}>
                  open
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {thread.listing.postedBy.businessName ?? thread.listing.postedBy.fullName}
                </span>{" "}
                (License {thread.listing.postedBy.licenseNumber ?? "—"}) ↔{" "}
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {thread.retailer.businessName ?? thread.retailer.fullName}
                </span>{" "}
                (License {thread.retailer.licenseNumber ?? "—"})
              </p>
              <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                {thread.rounds.map((round) => (
                  <li key={round.id}>
                    <span className="font-medium">
                      {round.actorRole === "seller"
                        ? thread.listing.postedBy.businessName ?? thread.listing.postedBy.fullName
                        : thread.retailer.businessName ?? thread.retailer.fullName}
                    </span>{" "}
                    {round.action}
                    {round.price != null ? ` — $${round.price}/${thread.listing.unit}` : ""}
                    {round.terms ? ` (${TERMS_LABELS[round.terms as Terms] ?? round.terms})` : ""}
                  </li>
                ))}
                {thread.rounds.length === 0 && <li>No rounds yet — listing posted as-is.</li>}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {closed.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
            Closed ({closed.length})
          </h2>
          <div className="space-y-2">
            {closed.map((thread) => (
              <div
                key={thread.id}
                className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 flex items-center justify-between gap-2"
              >
                <div>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{thread.listing.strainName}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {thread.listing.postedBy.businessName ?? thread.listing.postedBy.fullName} ↔{" "}
                    {thread.retailer.businessName ?? thread.retailer.fullName}
                    {thread.deal ? ` · $${thread.deal.finalPrice}/${thread.listing.unit} × ${thread.deal.finalQuantity}` : ""}
                  </p>
                </div>
                <span
                  className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0 ${
                    STATUS_STYLE[thread.status] ?? STATUS_STYLE.rejected
                  }`}
                >
                  {thread.deal ? "deal" : thread.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
