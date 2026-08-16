import { allThreadsForBroker, allDealsForBroker } from "@/lib/offers";
import { TERMS_LABELS, SHIPMENT_STATUS_LABELS, type Terms, type ShipmentStatus } from "@/lib/constants";
import { CommissionForm } from "@/components/broker/commission-form";

// Full, real-identity, platform-wide view — the one place in the app where
// both sides of a blind negotiation are ever shown together. See CLAUDE.md
// decisions #2 and #3.
export async function BrokerDashboard({
  setCommissionAction,
  markCommissionPaidAction,
}: {
  setCommissionAction: (formData: FormData) => void;
  markCommissionPaidAction: (formData: FormData) => void;
}) {
  const [threads, deals] = await Promise.all([allThreadsForBroker(), allDealsForBroker()]);
  const openThreads = threads.filter((t) => t.status === "open");
  const closedThreads = threads.filter((t) => t.status !== "open");

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
          Active negotiations
        </h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          Every negotiation on the platform, in real identity — {openThreads.length} open.
        </p>

        {openThreads.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400">No open negotiations.</p>
        )}

        <div className="space-y-3">
          {openThreads.map((thread) => (
            <div
              key={thread.id}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4"
            >
              <div className="flex items-start justify-between mb-1">
                <h3 className="font-medium text-gray-900 dark:text-gray-100">
                  {thread.listing.strainName}
                </h3>
                <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">
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
                        ? thread.listing.postedBy.fullName
                        : thread.retailer.fullName}
                    </span>{" "}
                    {round.action}
                    {round.price != null ? ` — $${round.price}` : ""}
                    {round.terms ? ` (${TERMS_LABELS[round.terms as Terms] ?? round.terms})` : ""}
                  </li>
                ))}
                {thread.rounds.length === 0 && <li>No rounds yet — listing posted as-is.</li>}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
          Closed deals ({deals.length})
        </h2>
        {deals.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400">No deals closed yet.</p>
        )}
        <div className="space-y-2">
          {deals.map((deal) => (
            <div
              key={deal.id}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-900 dark:text-gray-100">
                  {deal.thread.listing.strainName}
                </h3>
                <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
                  deal
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {deal.seller.businessName ?? deal.seller.fullName}
                </span>{" "}
                (License {deal.seller.licenseNumber ?? "—"}) sells to{" "}
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {deal.retailer.businessName ?? deal.retailer.fullName}
                </span>{" "}
                (License {deal.retailer.licenseNumber ?? "—"})
              </p>
              <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                {deal.finalQuantity} {deal.thread.listing.unit} @ ${deal.finalPrice}/
                {deal.thread.listing.unit} ·{" "}
                {TERMS_LABELS[deal.finalTerms as Terms] ?? deal.finalTerms}
              </p>
              {!deal.invoiceUrl && (
                <p className="mt-1 text-xs text-gray-400">Awaiting invoice from seller</p>
              )}
              {deal.invoiceUrl && !deal.shipment && (
                <p className="mt-1 text-xs text-gray-400">
                  Invoice uploaded — awaiting retailer to accept and pick a transporter
                </p>
              )}
              {deal.shipment && (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Shipped via{" "}
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {deal.shipment.transporter.businessName ?? deal.shipment.transporter.fullName}
                  </span>{" "}
                  —{" "}
                  <span className="text-blue-700 dark:text-blue-400">
                    {SHIPMENT_STATUS_LABELS[deal.shipment.status as ShipmentStatus] ?? deal.shipment.status}
                  </span>
                </p>
              )}
              {deal.productStatus === "accepted" && (
                <p className="mt-1 text-xs text-green-700 dark:text-green-400 font-medium">
                  Product accepted — final
                </p>
              )}
              {deal.productStatus === "rejected" && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400 font-medium">
                  Product rejected — needs off-platform resolution
                </p>
              )}
              <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                <CommissionForm
                  dealId={deal.id}
                  commission={deal.commission}
                  setAction={setCommissionAction}
                  markPaidAction={markCommissionPaidAction}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {closedThreads.filter((t) => t.status === "rejected").length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
            Rejected negotiations
          </h2>
          <div className="space-y-2">
            {closedThreads
              .filter((t) => t.status === "rejected")
              .map((thread) => (
                <div
                  key={thread.id}
                  className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 text-sm text-gray-500 dark:text-gray-400"
                >
                  {thread.listing.strainName} — {thread.listing.postedBy.fullName} ↔{" "}
                  {thread.retailer.fullName}
                </div>
              ))}
          </div>
        </section>
      )}
    </div>
  );
}
