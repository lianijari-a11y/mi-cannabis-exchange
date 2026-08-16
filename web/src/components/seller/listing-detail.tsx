import { notFound } from "next/navigation";
import { Eye, FlaskConical, Star } from "lucide-react";
import { getListingForSeller } from "@/lib/listings";
import { threadsForListing, recordThreadView } from "@/lib/offers";
import { retailerRatingForThread } from "@/lib/market";
import { splitContractsForListing } from "@/lib/split-contracts";
import { CATEGORY_LABELS, TERMS_LABELS, type Category, type Terms } from "@/lib/constants";
import { RespondForm } from "@/components/seller/respond-form";
import { DealPanelSeller } from "@/components/deal/deal-panel-seller";

export async function SellerListingDetail({
  listingId,
  sellerId,
  respondAction,
  invoiceAction,
  splitContractRespondAction,
  confirmFreshAction,
  acceptScheduleAction,
  acceptRejectionCounterAction,
  requireReturnAction,
}: {
  listingId: string;
  sellerId: string;
  respondAction: (formData: FormData) => void;
  invoiceAction: (formData: FormData) => void;
  splitContractRespondAction: (formData: FormData) => void;
  confirmFreshAction?: (formData: FormData) => void;
  acceptScheduleAction?: (formData: FormData) => void;
  acceptRejectionCounterAction?: (formData: FormData) => void;
  requireReturnAction?: (formData: FormData) => void;
}) {
  const listing = await getListingForSeller(listingId, sellerId);
  if (!listing) notFound();

  const staleDays = Math.floor(
    (Date.now() - new Date(listing.lastConfirmedAt).getTime()) / (24 * 60 * 60 * 1000)
  );

  const threads = await threadsForListing(listingId, sellerId);
  // Seller is looking at every thread on this page right now — log a view
  // for each so the retailer side can be alerted ("the seller viewed your
  // offer").
  await Promise.all(threads.map((t) => recordThreadView(t.id, "seller")));
  const retailerRatings = await Promise.all(
    threads.map((t) => retailerRatingForThread(t.id))
  );

  const splitContracts = await splitContractsForListing(listingId, sellerId);

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
        <h1 className="font-semibold text-gray-900 dark:text-gray-100">{listing.strainName}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {CATEGORY_LABELS[listing.category as Category] ?? listing.category}
          {listing.thcPercent != null ? ` · ${listing.thcPercent}% THC` : ""}
        </p>
        <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
          {listing.quantity} {listing.unit} · ${listing.pricePerUnit}/{listing.unit} ·{" "}
          {TERMS_LABELS[listing.terms as Terms] ?? listing.terms}
        </p>
        {listing.notes && (
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{listing.notes}</p>
        )}
        {listing.status === "active" && confirmFreshAction && (
          <div className="mt-3 flex items-center gap-2">
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {staleDays === 0 ? "Confirmed available today" : `Last confirmed available ${staleDays}d ago`}
            </p>
            <form action={confirmFreshAction}>
              <input type="hidden" name="listingId" value={listing.id} />
              <button
                type="submit"
                className="text-[10px] uppercase tracking-wide border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-full px-2 py-0.5"
              >
                Still available? Confirm
              </button>
            </form>
          </div>
        )}
        {listing.media.length > 0 && (
          <div className="mt-3 flex gap-2 overflow-x-auto">
            {listing.media.map((m) => (
              <div key={m.id} className="relative shrink-0">
                {m.type === "video" ? (
                  <video src={m.url} controls className="h-28 rounded-lg" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.url} alt="" className="h-28 rounded-lg object-cover" />
                )}
                {m.redactionAttempted && m.redactionRegionsFound > 0 && (
                  <span
                    title="Experimental auto-redaction blacked out something it thought was a logo or contact info — double-check this photo before relying on it."
                    className="absolute bottom-1 left-1 text-[9px] bg-amber-600 text-white rounded px-1.5 py-0.5"
                  >
                    Auto-redacted — review
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Negotiations ({threads.length})
        </h2>
        {threads.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No offers yet on this listing.
          </p>
        )}
        <div className="space-y-3">
          {threads.map((thread, i) => {
            const rating = retailerRatings[i];
            return (
            <div
              key={thread.id}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                  {thread.retailer.anonHandle}
                  {rating.score != null ? (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-normal text-amber-600 dark:text-amber-400">
                      <Star className="w-3 h-3 fill-current" /> {rating.score}
                    </span>
                  ) : (
                    <span className="text-[10px] font-normal text-gray-400">new buyer</span>
                  )}
                </span>
                <div className="flex items-center gap-2">
                  {thread.retailerViewCount > 0 && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-gray-400">
                      <Eye className="w-3 h-3" /> viewed {thread.retailerViewCount}x
                    </span>
                  )}
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
              </div>

              <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                {thread.rounds.map((round) => (
                  <li key={round.id}>
                    <span className="font-medium">
                      {round.actorRole === "seller" ? "You" : thread.retailer.anonHandle}
                    </span>{" "}
                    {round.action === "accept"
                      ? "accepted"
                      : round.action === "reject"
                      ? "rejected"
                      : "countered"}
                    {round.price != null ? ` — $${round.price}` : ""}
                    {round.terms ? ` (${TERMS_LABELS[round.terms as Terms] ?? round.terms})` : ""}
                    {round.message ? ` — "${round.message}"` : ""}
                  </li>
                ))}
              </ul>

              {thread.status === "open" && (
                <RespondForm
                  action={respondAction}
                  threadId={thread.id}
                  listingId={listing.id}
                />
              )}

              {thread.status === "accepted" && thread.deal && (
                <DealPanelSeller
                  deal={thread.deal}
                  listingId={listing.id}
                  invoiceAction={invoiceAction}
                  acceptScheduleAction={acceptScheduleAction}
                  acceptRejectionCounterAction={acceptRejectionCounterAction}
                  requireReturnAction={requireReturnAction}
                />
              )}
            </div>
            );
          })}
        </div>
      </div>

      {splitContracts.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-1.5">
            <FlaskConical className="w-4 h-4 text-teal-600" /> Toll-processing proposals (
            {splitContracts.length})
          </h2>
          <div className="space-y-3">
            {splitContracts.map((contract) => (
              <div
                key={contract.id}
                className="bg-white dark:bg-gray-900 border border-teal-200 dark:border-teal-900 rounded-xl p-4"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {contract.processor.anonHandle} — {contract.outputProduct}
                  </span>
                  <span className="text-xs font-mono bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-400 px-2 py-0.5 rounded-full">
                    {contract.splitGrowerPct}/{100 - contract.splitGrowerPct} split
                  </span>
                </div>
                {contract.note && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{contract.note}</p>
                )}
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  Status: {contract.status}
                </p>
                {contract.status === "proposed" && (
                  <div className="flex gap-2">
                    <form action={splitContractRespondAction}>
                      <input type="hidden" name="contractId" value={contract.id} />
                      <input type="hidden" name="listingId" value={listing.id} />
                      <input type="hidden" name="decision" value="accepted" />
                      <button
                        type="submit"
                        className="bg-teal-700 text-white rounded-lg px-3 py-1.5 text-xs font-medium"
                      >
                        Accept
                      </button>
                    </form>
                    <form action={splitContractRespondAction}>
                      <input type="hidden" name="contractId" value={contract.id} />
                      <input type="hidden" name="listingId" value={listing.id} />
                      <input type="hidden" name="decision" value="rejected" />
                      <button
                        type="submit"
                        className="border border-red-300 dark:border-red-800 text-red-600 rounded-lg px-3 py-1.5 text-xs font-medium"
                      >
                        Reject
                      </button>
                    </form>
                  </div>
                )}
                {contract.status === "settled" && (
                  <p className="text-xs text-teal-700 dark:text-teal-400 font-medium">
                    Settled at ${contract.settlementValue} — you receive $
                    {contract.settlementGrowerAmount}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
