"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { AccountMenuItem } from "@/components/sales/account-menu-item";
import { ShareMenuLink } from "@/components/sales/share-menu-link";
import { BulkPhotoUpload } from "@/components/seller/bulk-photo-upload";
import { BulkPriceUpdate } from "@/components/seller/bulk-price-update";
import { matchPhotosToMenu } from "@/lib/ai-listing";

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
  visibility: string;
  minimumOrderQuantity: number | null;
  belowMinimumPricePerUnit: number | null;
  media: Media[];
};

// One menu (CLAUDE.md §40) — collapsed by default so a 34-product bulk
// upload reads as one line on the account page, not 34. Click the header
// to open it and see/edit the individual strains underneath.
export function MenuSection({
  batchId,
  uploadedLabel,
  listings,
  editAction,
  bulkPhotoSaveAction,
  bulkPriceSaveAction,
}: {
  batchId: string;
  uploadedLabel: string;
  listings: Listing[];
  editAction: (formData: FormData) => void;
  // Optional — only the AE/Admin account pages pass this (CLAUDE.md's bulk
  // photo upload feature); the seller's own dashboard renders its own,
  // differently-scoped copy of BulkPhotoUpload directly.
  bulkPhotoSaveAction?: (
    batchId: string,
    assignments: { listingId: string; url: string; contentType: string }[]
  ) => Promise<{ ok: true; savedCount: number } | { ok: false; error: string }>;
  bulkPriceSaveAction?: (
    batchId: string,
    adjustment: { mode: "percent" | "dollar" | "targetTotal"; value: number }
  ) => Promise<{ ok: true; updatedCount: number } | { ok: false; error: string }>;
}) {
  const [open, setOpen] = useState(false);
  const active = listings.filter((l) => l.status === "active").length;
  const activeListings = listings.filter((l) => l.status === "active");
  // Same gate the public page itself enforces (lib/listings.ts's
  // publicMenuView) — only offer the link when at least one product would
  // actually show up on it. A menu with everything closed or every row
  // individually marked Admin-exclusive just doesn't get a share button.
  const anyShareable = listings.some((l) => l.status === "active" && l.visibility === "all");

  return (
    <div>
      {/* A plain clickable div, not a <button> — ShareMenuLink below renders
          its own <button>, and interactive content can't legally nest
          inside a <button> (browsers silently break out of it, which
          desyncs the server-rendered HTML from the client render and
          triggers a real React hydration mismatch — confirmed live in the
          console, not just a lint nit). role="button" + a key handler keep
          this keyboard-operable without the invalid nesting. */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((o) => !o);
          }
        }}
        className="w-full flex items-center justify-between gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 text-left hover:border-green-300 dark:hover:border-green-800 cursor-pointer"
      >
        <span className="flex items-center gap-2">
          {open ? (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400" />
          )}
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            Menu uploaded {uploadedLabel}
          </span>
        </span>
        <span className="flex items-center gap-2 shrink-0">
          {anyShareable && <ShareMenuLink batchId={batchId} />}
          <span className="text-[11px] text-gray-400">
            {listings.length} product{listings.length === 1 ? "" : "s"}
            {active < listings.length ? ` · ${active} active` : ""}
          </span>
        </span>
      </div>
      {open && (
        <div className="mt-3 space-y-3 pl-2">
          {bulkPhotoSaveAction && activeListings.length > 0 && (
            <BulkPhotoUpload
              batchId={batchId}
              listings={activeListings}
              matchAction={matchPhotosToMenu}
              saveAction={bulkPhotoSaveAction}
            />
          )}
          {bulkPriceSaveAction && activeListings.length > 0 && (
            <BulkPriceUpdate batchId={batchId} listings={activeListings} saveAction={bulkPriceSaveAction} />
          )}
          {listings.map((listing) => (
            <AccountMenuItem key={listing.id} listing={listing} editAction={editAction} />
          ))}
        </div>
      )}
    </div>
  );
}
