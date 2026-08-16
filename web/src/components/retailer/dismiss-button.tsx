"use client";

import { useState, useTransition } from "react";
import { EyeOff } from "lucide-react";
import { toggleDismissalAction } from "@/app/retailer/dismissal-actions";

// "Not interested" — hides the listing from this retailer's own feed on the
// next load. Reversible in principle (toggleDismissalAction flips it back),
// but there's no dedicated undo view yet — same scope-cut spirit as
// Watchlist not having extra chrome beyond the toggle.
export function DismissButton({ listingId }: { listingId: string }) {
  const [dismissed, setDismissed] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDismissed(true);
        startTransition(async () => {
          await toggleDismissalAction(listingId);
        });
      }}
      title="Not interested"
      className="inline-flex items-center gap-1.5 text-xs rounded-full px-3 py-1.5 border border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400"
    >
      <EyeOff className="w-3.5 h-3.5" />
      {dismissed ? "Hidden" : "Not interested"}
    </button>
  );
}
