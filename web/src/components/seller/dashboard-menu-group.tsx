"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { BulkPhotoUpload } from "@/components/seller/bulk-photo-upload";
import { matchPhotosToMenu } from "@/lib/ai-listing";

type ListingOption = { id: string; strainName: string };
type SaveResult = { ok: true; savedCount: number } | { ok: false; error: string };

// Groups the seller's own dashboard into menus (CLAUDE.md §40's grouping,
// now on the seller's own portal too — it previously only existed on the
// AE/Admin account pages) so a "Bulk add photos" action has somewhere to
// live for a menu that's already been posted. A Server Component (the
// dashboard) passes the already-rendered card grid in as `children` — this
// wrapper only owns the collapse state and the upload panel, not the cards
// themselves.
export function DashboardMenuGroup({
  batchId,
  uploadedLabel,
  productCount,
  activeCount,
  activeListings,
  saveAction,
  defaultOpen,
  children,
}: {
  batchId: string;
  uploadedLabel: string;
  productCount: number;
  activeCount: number;
  activeListings: ListingOption[];
  saveAction: (batchId: string, assignments: { listingId: string; url: string; contentType: string }[]) => Promise<SaveResult>;
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 text-left hover:border-green-300 dark:hover:border-green-800"
      >
        <span className="flex items-center gap-2">
          {open ? (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400" />
          )}
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            Menu posted {uploadedLabel}
          </span>
        </span>
        <span className="text-[11px] text-gray-400">
          {productCount} product{productCount === 1 ? "" : "s"}
          {activeCount < productCount ? ` · ${activeCount} active` : ""}
        </span>
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          {activeListings.length > 0 && (
            <BulkPhotoUpload
              batchId={batchId}
              listings={activeListings}
              matchAction={matchPhotosToMenu}
              saveAction={saveAction}
            />
          )}
          {children}
        </div>
      )}
    </div>
  );
}
