"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { CATEGORY_LABELS, TERMS_LABELS, type Category, type Terms } from "@/lib/constants";
import { EditListingForm } from "@/components/seller/edit-listing-form";

type Media = { id: string; url: string; type: string };
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
  minimumOrderQuantity: number | null;
  belowMinimumPricePerUnit: number | null;
  media: Media[];
};

const STATUS_STYLE: Record<string, string> = {
  active: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
  closed: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
  expired: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
};

// One row of an account's "menu" (CLAUDE.md §38) — every listing that
// business has ever posted, each independently editable in place while
// still active. Deliberately simpler than ListingHeaderCard (no freshness
// bump, no shareable link) — this is the AE's account-management view, not
// the seller's own dashboard.
export function AccountMenuItem({
  listing,
  editAction,
}: {
  listing: Listing;
  editAction: (formData: FormData) => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
        <EditListingForm listing={listing} action={editAction} onCancel={() => setEditing(false)} />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-medium text-sm text-gray-900 dark:text-gray-100">{listing.strainName}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {CATEGORY_LABELS[listing.category as Category] ?? listing.category}
            {listing.thcPercent != null ? ` · ${listing.thcPercent}% THC` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full ${STATUS_STYLE[listing.status] ?? STATUS_STYLE.closed}`}>
            {listing.status}
          </span>
          {listing.status === "active" && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-400 border border-green-200 dark:border-green-900 rounded-full px-2 py-0.5"
            >
              <Pencil className="w-3 h-3" /> Edit
            </button>
          )}
        </div>
      </div>
      <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
        {listing.quantity} {listing.unit} · ${listing.pricePerUnit}/{listing.unit} ·{" "}
        {TERMS_LABELS[listing.terms as Terms] ?? listing.terms}
      </p>
      {listing.notes && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{listing.notes}</p>}
      {listing.media.length > 0 && (
        <div className="mt-2 flex gap-2 overflow-x-auto">
          {listing.media.map((m) => (
            <div key={m.id} className="shrink-0">
              {m.type === "video" ? (
                <video src={m.url} controls className="h-20 rounded-lg" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.url} alt="" className="h-20 rounded-lg object-cover" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
