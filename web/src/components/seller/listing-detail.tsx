import { notFound } from "next/navigation";
import { getListingForSeller } from "@/lib/listings";
import { threadsForListing } from "@/lib/offers";
import { CATEGORY_LABELS, TERMS_LABELS, type Category, type Terms } from "@/lib/constants";
import { RespondForm } from "@/components/seller/respond-form";
import { DealPanelSeller } from "@/components/deal/deal-panel-seller";

export async function SellerListingDetail({
  listingId,
  sellerId,
  respondAction,
  invoiceAction,
}: {
  listingId: string;
  sellerId: string;
  respondAction: (formData: FormData) => void;
  invoiceAction: (formData: FormData) => void;
}) {
  const listing = await getListingForSeller(listingId, sellerId);
  if (!listing) notFound();

  const threads = await threadsForListing(listingId, sellerId);

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
        {listing.media.length > 0 && (
          <div className="mt-3 flex gap-2 overflow-x-auto">
            {listing.media.map((m) =>
              m.type === "video" ? (
                <video key={m.id} src={m.url} controls className="h-28 rounded-lg" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={m.id} src={m.url} alt="" className="h-28 rounded-lg object-cover" />
              )
            )}
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
          {threads.map((thread) => (
            <div
              key={thread.id}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {thread.retailer.anonHandle}
                </span>
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
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
