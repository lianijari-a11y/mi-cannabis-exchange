import { notFound } from "next/navigation";
import { Droplet, Star, Eye } from "lucide-react";
import { getListingAnonymized } from "@/lib/listings";
import { threadForRetailerListing, recordThreadView } from "@/lib/offers";
import { transportersForSelection } from "@/lib/shipments";
import { sellerRatingForListing } from "@/lib/market";
import { isWatchlisted } from "@/lib/watchlist";
import { suggestedMidpoint } from "@/lib/ai-negotiation";
import { CATEGORY_LABELS, TERMS_LABELS, type Category, type Terms } from "@/lib/constants";
import { RespondForm } from "@/components/seller/respond-form";
import { NegotiationControls } from "@/components/ai-negotiation/negotiation-controls";
import { AiMandatePanel } from "@/components/ai-negotiation/ai-mandate-panel";
import { AiNegotiationPoll } from "@/components/ai-negotiation/ai-negotiation-poll";
import { DealPanelRetailer } from "@/components/deal/deal-panel-retailer";
import { timeRemaining } from "@/components/retailer/listing-card";
import { SoldComps } from "@/components/sold-comps";
import { WatchlistButton } from "@/components/retailer/watchlist-button";

export async function RetailerListingDetail({
  listingId,
  retailerId,
  respondAction,
  acceptInvoiceAction,
  acceptProductAction,
  rejectProductAction,
  chooseReturnAction,
  proposeRejectionCounterAction,
  acceptScheduleAction,
  setDeliveryInstructionsAction,
  optInAiAction,
  takeBackAiAction,
  pollAiAction,
  error,
}: {
  listingId: string;
  retailerId: string;
  respondAction: (formData: FormData) => void;
  acceptInvoiceAction: (formData: FormData) => void;
  acceptProductAction: (formData: FormData) => void;
  rejectProductAction: (formData: FormData) => void;
  chooseReturnAction?: (formData: FormData) => void;
  proposeRejectionCounterAction?: (formData: FormData) => void;
  acceptScheduleAction?: (formData: FormData) => void;
  setDeliveryInstructionsAction?: (formData: FormData) => void;
  optInAiAction: (formData: FormData) => void;
  takeBackAiAction: (formData: FormData) => void;
  pollAiAction: (threadId: string) => Promise<void>;
  error?: string;
}) {
  const listing = await getListingAnonymized(listingId, retailerId);
  if (!listing) notFound();

  const thread = await threadForRetailerListing(listingId, retailerId);
  if (thread) await recordThreadView(thread.id, "retailer");

  const [transporters, rating, watching] = await Promise.all([
    thread?.status === "accepted" && thread.deal && !thread.deal.shipment
      ? transportersForSelection()
      : Promise.resolve([]),
    sellerRatingForListing(listingId),
    isWatchlisted(retailerId, listingId),
  ]);

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
        {listing.media.length > 0 && (
          <div className="flex gap-2 overflow-x-auto bg-gray-50 dark:bg-gray-950 p-3">
            {listing.media.map((m) =>
              m.type === "video" ? (
                <video key={m.id} src={m.url} controls className="h-48 rounded-lg" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={m.id} src={m.url} alt="" className="h-48 rounded-lg object-cover" />
              )
            )}
          </div>
        )}

        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {listing.strainName}
              </h1>
              <span className="mt-1 inline-block text-[10px] font-medium uppercase tracking-wide bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">
                {CATEGORY_LABELS[listing.category as Category] ?? listing.category}
              </span>
            </div>
            <div className="shrink-0 flex flex-col items-end gap-1.5">
              <span className="text-[10px] text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-gray-700 rounded-full px-2 py-1">
                {listing.postedBy.anonHandle}
              </span>
              {rating.score != null ? (
                <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
                  <Star className="w-3 h-3 fill-current" /> {rating.score} ({rating.count})
                </span>
              ) : (
                <span className="text-[10px] text-gray-400">New seller — no history yet</span>
              )}
              <WatchlistButton listingId={listing.id} initialWatching={watching} />
            </div>
          </div>

          <div className="mt-3 flex items-center gap-4 text-sm text-gray-600 dark:text-gray-300">
            {listing.thcPercent != null && (
              <span className="inline-flex items-center gap-1">
                <Droplet className="w-3.5 h-3.5 text-green-600" />
                {listing.thcPercent}% THC
              </span>
            )}
            <span>
              {listing.quantity} {listing.unit}
            </span>
            <span className="text-[10px] uppercase tracking-wide bg-green-700 text-white px-2 py-0.5 rounded-full">
              {TERMS_LABELS[listing.terms as Terms] ?? listing.terms}
            </span>
            {listing.status === "active" && timeRemaining(listing.expiresAt) && (
              <span className="text-xs text-amber-600 dark:text-amber-400">
                {timeRemaining(listing.expiresAt)}
              </span>
            )}
          </div>

          <p className="mt-3 text-2xl font-semibold text-green-700 dark:text-green-400">
            ${listing.pricePerUnit}
            <span className="text-sm font-normal text-gray-400"> /{listing.unit}</span>
          </p>

          {listing.notes && (
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">{listing.notes}</p>
          )}
        </div>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Negotiation
        </h2>

        {!thread && listing.status === "active" && (
          <RespondForm action={respondAction} threadId="" listingId={listing.id} />
        )}
        {!thread && listing.status !== "active" && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            This listing {listing.status === "expired" ? "has expired" : "is no longer active"}.
          </p>
        )}

        {thread && (
          <>
            <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-400 mb-2">
              {thread.rounds.map((round) => (
                <li key={round.id}>
                  <span className="font-medium">
                    {round.actorRole === "retailer" ? "You" : listing.postedBy.anonHandle}
                  </span>{" "}
                  {round.aiGenerated && (
                    <span className="text-[9px] font-semibold uppercase tracking-wide bg-green-700 text-white px-1.5 py-0.5 rounded-full mr-1">
                      AI
                    </span>
                  )}
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
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-2">
              <span>Status: {thread.status}</span>
              {thread.sellerViewCount > 0 && (
                <span className="inline-flex items-center gap-1 text-gray-400">
                  <Eye className="w-3 h-3" /> seller viewed {thread.sellerViewCount}x
                </span>
              )}
            </p>
            {thread.status === "open" && (
              <>
                <AiNegotiationPoll pollAction={pollAiAction.bind(null, thread.id)} />
                <AiMandatePanel
                  partyRole="retailer"
                  mandate={thread.mandates[0] ?? null}
                  needsBrokerMediation={thread.needsBrokerMediation}
                  optInAction={optInAiAction}
                  takeBackAction={takeBackAiAction}
                  threadId={thread.id}
                  listingId={listing.id}
                  defaultPrice={listing.pricePerUnit}
                />
                {!thread.mandates[0]?.active &&
                  !thread.needsBrokerMediation &&
                  suggestedMidpoint(thread.rounds) != null && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
                      Suggested compromise: ${suggestedMidpoint(thread.rounds)}/unit — just a hint,
                      nothing is sent unless you submit it yourself below.
                    </p>
                  )}
                <NegotiationControls
                  action={respondAction}
                  threadId={thread.id}
                  listingId={listing.id}
                  hidden={thread.mandates[0]?.active}
                  suggestions={thread.brokerSuggestions}
                />
              </>
            )}

            {thread.status === "accepted" && thread.deal && (
              <DealPanelRetailer
                deal={thread.deal}
                listingId={listing.id}
                transporters={transporters}
                acceptInvoiceAction={acceptInvoiceAction}
                acceptProductAction={acceptProductAction}
                rejectProductAction={rejectProductAction}
                chooseReturnAction={chooseReturnAction}
                proposeRejectionCounterAction={proposeRejectionCounterAction}
                acceptScheduleAction={acceptScheduleAction}
                setDeliveryInstructionsAction={setDeliveryInstructionsAction}
              />
            )}
          </>
        )}
      </div>

      <SoldComps category={listing.category} excludeListingId={listing.id} />
    </div>
  );
}
