"use server";

import { handleToggleWatchlist } from "@/lib/retailer-actions";

export async function toggleWatchlistAction(listingId: string) {
  return handleToggleWatchlist(listingId);
}
