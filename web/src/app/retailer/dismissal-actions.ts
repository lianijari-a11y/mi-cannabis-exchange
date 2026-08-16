"use server";

import { handleToggleDismissal } from "@/lib/retailer-actions";

export async function toggleDismissalAction(listingId: string) {
  return handleToggleDismissal(listingId);
}
