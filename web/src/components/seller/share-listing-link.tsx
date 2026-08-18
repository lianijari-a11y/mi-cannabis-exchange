"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";

// "Get shareable link" (CLAUDE.md §36) — only meaningful for a listing any
// retailer could already see (visibility "all"); an Admin-restricted
// exclusive listing shouldn't get a public link that bypasses that
// restriction, so the caller only renders this when visibility === "all".
export function ShareListingLink({ listingId }: { listingId: string }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? `${window.location.origin}/listing/${listingId}` : `/listing/${listingId}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API unavailable — fall back to a visible link the user can select
    }
  }

  return (
    <div className="mt-3 flex items-center gap-2">
      <button
        type="button"
        onClick={copy}
        className="inline-flex items-center gap-1.5 text-xs border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-full px-2.5 py-1"
      >
        <Share2 className="w-3 h-3" />
        {copied ? "Link copied" : "Get shareable link"}
      </button>
      <span className="text-[11px] text-gray-400 truncate">{url}</span>
    </div>
  );
}
