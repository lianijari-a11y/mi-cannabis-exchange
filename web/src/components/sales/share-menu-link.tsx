"use client";

import { useEffect, useState } from "react";
import { Share2 } from "lucide-react";

// Menu-level counterpart to components/seller/share-listing-link.tsx
// (CLAUDE.md §40) — shares every currently-shareable product in this batch
// as one link, not one at a time. Only rendered by the caller when at
// least one listing in the batch actually qualifies (status "active" AND
// visibility "all") — an all-exclusive or all-closed menu just doesn't
// offer this at all, same "quietly not available" posture as the public
// page itself (lib/listings.ts's publicMenuView).
export function ShareMenuLink({
  batchId,
  path = "menu",
  label = "Share menu",
}: {
  batchId: string;
  // "menu" for a single-menu link (/menu/[batchId]), "collection" for a
  // multi-menu bundle (/collection/[id]) — same button, different route.
  path?: "menu" | "collection";
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const url = `${origin}/${path}/${batchId}`;

  async function copy(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API unavailable — the visible URL text is the fallback
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={copy}
        className="inline-flex items-center gap-1.5 text-[11px] text-green-700 dark:text-green-400 border border-green-200 dark:border-green-900 rounded-full px-2 py-0.5 shrink-0"
      >
        <Share2 className="w-3 h-3" />
        {copied ? "Link copied" : label}
      </button>
      <span className="text-[11px] text-gray-400 truncate">{url}</span>
    </span>
  );
}
