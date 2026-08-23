"use client";

import { useMemo, useState } from "react";
import type { allThreadsForBroker, allDealsForBroker } from "@/lib/offers";
import { TERMS_LABELS, SHIPMENT_STATUS_LABELS, type Terms, type ShipmentStatus } from "@/lib/constants";
import { CommissionForm } from "@/components/broker/commission-form";
import { BrokerSuggestionForm } from "@/components/broker/broker-suggestion-form";

type Thread = Awaited<ReturnType<typeof allThreadsForBroker>>[number];
type Deal = Awaited<ReturnType<typeof allDealsForBroker>>[number];

function threadHaystack(t: Thread): string {
  return [
    t.listing.strainName,
    t.listing.postedBy.businessName,
    t.listing.postedBy.fullName,
    t.listing.postedBy.licenseNumber,
    t.retailer.businessName,
    t.retailer.fullName,
    t.retailer.licenseNumber,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function dealHaystack(d: Deal): string {
  return [
    d.thread.listing.strainName,
    d.seller.businessName,
    d.seller.fullName,
    d.seller.licenseNumber,
    d.retailer.businessName,
    d.retailer.fullName,
    d.retailer.licenseNumber,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

// Split out of broker-dashboard.tsx so the search box (CLAUDE.md — added
// after AE/Admin's negotiations and orders dashboards got the same
// treatment) has somewhere to hold state — the platform-wide, real-
// identity list here is the single largest one in the app and arguably
// needed this the most. Plain client-side substring filter on the
// already-fetched data, same "no new index needed at this data volume"
// posture as every other search box in this app.
export function BrokerDashboardView({
  threads,
  deals,
  setCommissionAction,
  markCommissionPaidAction,
  suggestPriceAction,
}: {
  threads: Thread[];
  deals: Deal[];
  setCommissionAction: (formData: FormData) => void;
  markCommissionPaidAction: (formData: FormData) => void;
  suggestPriceAction: (formData: FormData) => void;
}) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();

  const filteredThreads = useMemo(
    () => (needle ? threads.filter((t) => threadHaystack(t).includes(needle)) : threads),
    [threads, needle]
  );
  const filteredDeals = useMemo(
    () => (needle ? deals.filter((d) => dealHaystack(d).includes(needle)) : deals),
    [deals, needle]
  );

  const needsMediationThreads = filteredThreads.filter((t) => t.status === "open" && t.needsBrokerMediation);
  const openThreads = filteredThreads.filter((t) => t.status === "open" && !t.needsBrokerMediation);
  const closedThreads = filteredThreads.filter((t) => t.status !== "open");
  const rejectedThreads = closedThreads.filter((t) => t.status === "rejected");

  return (
    <div className="space-y-8">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search strain, business name, or license number…"
        className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-transparent"
      />

      {needsMediationThreads.length > 0 && (
        <section>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
            Needs mediation ({needsMediationThreads.length})
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            AI-assisted negotiation couldn&apos;t reach a deal within the approved range on these —
            suggest a price to help close them.
          </p>
          <div className="space-y-3">
            {needsMediationThreads.map((thread) => (
              <div
                key={thread.id}
                className="bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-900 rounded-xl p-4"
              >
                <div className="flex items-start justify-between mb-1">
                  <h3 className="font-medium text-gray-900 dark:text-gray-100">
                    {thread.listing.strainName}
                  </h3>
                  <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">
                    needs mediation
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
                <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-400 mb-2">
                  {thread.rounds.map((round) => (
                    <li key={round.id}>
                      <span className="font-medium">
                        {round.actorRole === "seller"
                          ? thread.listing.postedBy.fullName
                          : thread.retailer.fullName}
                      </span>{" "}
                      {round.aiGenerated && (
                        <span className="text-[9px] font-semibold uppercase tracking-wide bg-green-700 text-white px-1.5 py-0.5 rounded-full mr-1">
                          AI
                        </span>
                      )}
                      {round.action}
                      {round.price != null ? ` — $${round.price}` : ""}
                    </li>
                  ))}
                </ul>
                <BrokerSuggestionForm
                  threadId={thread.id}
                  suggestions={thread.brokerSuggestions}
                  suggestAction={suggestPriceAction}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">Active negotiations</h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          Every negotiation on the platform, in real identity — {openThreads.length} open.
        </p>

        {openThreads.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {needle ? "No open negotiations match your search." : "No open negotiations."}
          </p>
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
          Closed deals ({filteredDeals.length})
        </h2>
        {filteredDeals.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {needle ? "No closed deals match your search." : "No deals closed yet."}
          </p>
        )}
        <div className="space-y-2">
          {filteredDeals.map((deal) => (
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
                  {deal.shipment.driverName && <> · driver: {deal.shipment.driverName}</>}
                  {deal.shipment.locationSharingEnabled && deal.shipment.lastLat != null && (
                    <span className="text-green-700 dark:text-green-400"> · live tracking on</span>
                  )}
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

      {rejectedThreads.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
            Rejected negotiations
          </h2>
          <div className="space-y-2">
            {rejectedThreads.map((thread) => (
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
