"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { CATEGORY_LABELS, TERMS_LABELS, type Category, type Terms } from "@/lib/constants";
import { EditListingForm } from "@/components/seller/edit-listing-form";
import { ShareListingLink } from "@/components/seller/share-listing-link";

type Media = { id: string; url: string; type: string; redactionAttempted: boolean; redactionRegionsFound: number };
type Listing = {
  id: string;
  strainName: string;
  category: string;
  thcPercent: number | null;
  quantity: number;
  unit: string;
  pricePerUnit: number;
  terms: string;
  notes: string | null;
  status: string;
  visibility: string;
  lastConfirmedAt: string | Date;
  minimumOrderQuantity: number | null;
  belowMinimumPricePerUnit: number | null;
  media: Media[];
};

// The seller's own "menu as it sells" header — toggles between a plain
// display and EditListingForm in place, so editing doesn't need a whole
// separate page. Only offered while status is "active" (see
// lib/listings.ts's updateListing) — a closed/expired listing is done.
export function ListingHeaderCard({
  listing,
  staleDays,
  confirmFreshAction,
  editAction,
  editError,
}: {
  listing: Listing;
  staleDays: number;
  confirmFreshAction?: (formData: FormData) => void;
  editAction?: (formData: FormData) => void;
  editError?: string;
}) {
  const [editing, setEditing] = useState(false);

  if (editing && editAction) {
    return (
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
        <h1 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Edit listing</h1>
        <EditListingForm
          listing={listing}
          action={editAction}
          onCancel={() => setEditing(false)}
          error={editError}
        />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
      <div className="flex items-start justify-between gap-2">
        <h1 className="font-semibold text-gray-900 dark:text-gray-100">{listing.strainName}</h1>
        {listing.status === "active" && editAction && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="shrink-0 inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-400 border border-green-200 dark:border-green-900 rounded-full px-2.5 py-1"
          >
            <Pencil className="w-3 h-3" /> Edit
          </button>
        )}
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {CATEGORY_LABELS[listing.category as Category] ?? listing.category}
        {listing.thcPercent != null ? ` · ${listing.thcPercent}% THC` : ""}
      </p>
      <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
        {listing.quantity} {listing.unit} · ${listing.pricePerUnit}/{listing.unit} ·{" "}
        {TERMS_LABELS[listing.terms as Terms] ?? listing.terms}
      </p>
      {listing.notes && <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{listing.notes}</p>}
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
      {listing.status === "active" && listing.visibility === "all" && (
        <ShareListingLink listingId={listing.id} />
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
  );
}
