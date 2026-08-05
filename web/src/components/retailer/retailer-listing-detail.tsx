import { notFound } from "next/navigation";
import { Droplet } from "lucide-react";
import { getListingAnonymized } from "@/lib/listings";
import { threadForRetailerListing } from "@/lib/offers";
import { transportersForSelection } from "@/lib/shipments";
import { CATEGORY_LABELS, TERMS_LABELS, type Category, type Terms } from "@/lib/constants";
import { RespondForm } from "@/components/seller/respond-form";
import { DealPanelRetailer } from "@/components/deal/deal-panel-retailer";

export async function RetailerListingDetail({
  listingId,
  retailerId,
  respondAction,
  acceptInvoiceAction,
  error,
}: {
  listingId: string;
  retailerId: string;
  respondAction: (formData: FormData) => void;
  acceptInvoiceAction: (formData: FormData) => void;
  error?: string;
}) {
  const listing = await getListingAnonymized(listingId, retailerId);
  if (!listing) notFound();

  const thread = await threadForRetailerListing(listingId, retailerId);
  const transporters =
    thread?.status === "accepted" && thread.deal && !thread.deal.shipment
      ? await transportersForSelection()
      : [];

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
            <span className="shrink-0 text-[10px] text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-gray-700 rounded-full px-2 py-1">
              {listing.postedBy.anonHandle}
            </span>
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

        {!thread && (
          <RespondForm action={respondAction} threadId="" listingId={listing.id} />
        )}

        {thread && (
          <>
            <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-400 mb-2">
              {thread.rounds.map((round) => (
                <li key={round.id}>
                  <span className="font-medium">
                    {round.actorRole === "retailer" ? "You" : listing.postedBy.anonHandle}
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
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Status: {thread.status}</p>
            {thread.status === "open" && (
              <RespondForm action={respondAction} threadId={thread.id} listingId={listing.id} />
            )}

            {thread.status === "accepted" && thread.deal && (
              <DealPanelRetailer
                deal={thread.deal}
                listingId={listing.id}
                transporters={transporters}
                acceptInvoiceAction={acceptInvoiceAction}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
