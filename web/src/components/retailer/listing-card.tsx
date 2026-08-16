import Link from "next/link";
import { Leaf, Droplet } from "lucide-react";
import { CATEGORY_LABELS, TERMS_LABELS, type Category, type Terms } from "@/lib/constants";
import { WatchlistButton } from "@/components/retailer/watchlist-button";
import { DismissButton } from "@/components/retailer/dismiss-button";

export type FeedListing = {
  id: string;
  strainName: string;
  category: string;
  thcPercent: number | null;
  quantity: number;
  unit: string;
  pricePerUnit: number;
  terms: string;
  expiresAt: Date | string | null;
  lastConfirmedAt?: Date | string | null;
  media: { id: string; type: string; url: string }[];
  postedBy: { anonHandle: string };
};

const STALE_AFTER_DAYS = 3;

export function timeRemaining(expiresAt: Date | string | null): string | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return null;
  const hours = Math.ceil(ms / (60 * 60 * 1000));
  if (hours < 24) return `${hours}h left`;
  return `${Math.ceil(hours / 24)}d left`;
}

// The one place product presentation is defined, so every grower/processor/
// broker listing shows up to retailers in the same clean, consistent card —
// "presentation is everything," regardless of how rough the seller's raw
// upload was.
export function ListingCard({
  listing,
  watching = false,
}: {
  listing: FeedListing;
  watching?: boolean;
}) {
  const cover = listing.media[0];
  const remaining = timeRemaining(listing.expiresAt);
  const staleDays = listing.lastConfirmedAt
    ? Math.floor((Date.now() - new Date(listing.lastConfirmedAt).getTime()) / (24 * 60 * 60 * 1000))
    : null;
  const isStale = staleDays !== null && staleDays >= STALE_AFTER_DAYS;

  return (
    <Link
      href={`/retailer/listings/${listing.id}`}
      className="group bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden hover:shadow-lg hover:border-green-600 transition-all"
    >
      <div className="relative aspect-[4/3] bg-gradient-to-br from-green-50 to-gray-100 dark:from-green-950/40 dark:to-gray-800">
        {cover ? (
          cover.type === "video" ? (
            <video src={cover.url} muted className="w-full h-full object-cover" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cover.url}
              alt={listing.strainName}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          )
        ) : (
          <div className="w-full h-full flex items-center justify-center text-green-700/30 dark:text-green-400/20">
            <Leaf className="w-10 h-10" />
          </div>
        )}

        <span className="absolute top-2 left-2 text-[10px] font-medium uppercase tracking-wide bg-white/90 dark:bg-gray-900/90 text-gray-700 dark:text-gray-200 px-2 py-1 rounded-full backdrop-blur-sm">
          {CATEGORY_LABELS[listing.category as Category] ?? listing.category}
        </span>
        <span className="absolute top-2 right-2 text-[10px] font-medium uppercase tracking-wide bg-green-700/90 text-white px-2 py-1 rounded-full backdrop-blur-sm">
          {TERMS_LABELS[listing.terms as Terms] ?? listing.terms}
        </span>
        <div className="absolute bottom-2 right-2 flex gap-1.5">
          <DismissButton listingId={listing.id} />
          <WatchlistButton listingId={listing.id} initialWatching={watching} />
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 leading-snug">
            {listing.strainName}
          </h3>
          <span className="shrink-0 text-[10px] text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-gray-700 rounded-full px-2 py-0.5">
            {listing.postedBy.anonHandle}
          </span>
        </div>

        <div className="mt-2 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
          {listing.thcPercent != null && (
            <span className="inline-flex items-center gap-1">
              <Droplet className="w-3 h-3 text-green-600" />
              {listing.thcPercent}% THC
            </span>
          )}
          <span>
            {listing.quantity} {listing.unit}
          </span>
          {remaining && (
            <span className="text-amber-600 dark:text-amber-400">{remaining}</span>
          )}
          {isStale && (
            <span
              className="text-gray-400 dark:text-gray-500"
              title="The seller hasn't confirmed this is still available recently"
            >
              Not confirmed in {staleDays}d
            </span>
          )}
        </div>

        <p className="mt-3 text-lg font-semibold text-green-700 dark:text-green-400">
          ${listing.pricePerUnit}
          <span className="text-xs font-normal text-gray-400"> /{listing.unit}</span>
        </p>
      </div>
    </Link>
  );
}
