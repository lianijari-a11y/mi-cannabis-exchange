"use client";

import { useState, useTransition } from "react";
import { Eye } from "lucide-react";
import { toggleWatchlistAction } from "@/app/retailer/watchlist-actions";

export function WatchlistButton({
  listingId,
  initialWatching,
}: {
  listingId: string;
  initialWatching: boolean;
}) {
  const [watching, setWatching] = useState(initialWatching);
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={(e) => {
        // May be nested inside a <Link> (feed card) — never let the click
        // fall through to a navigation.
        e.preventDefault();
        e.stopPropagation();
        setWatching((w) => !w);
        startTransition(async () => {
          const nowWatching = await toggleWatchlistAction(listingId);
          setWatching(nowWatching);
        });
      }}
      className={`inline-flex items-center gap-1.5 text-xs rounded-full px-3 py-1.5 border transition-colors ${
        watching
          ? "bg-amber-100 border-amber-300 text-amber-800 dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-400"
          : "border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400"
      }`}
    >
      <Eye className="w-3.5 h-3.5" />
      {watching ? "Watching" : "Watch"}
    </button>
  );
}
