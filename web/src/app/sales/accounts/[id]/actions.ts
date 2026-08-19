"use server";

import { handleEditListingFromAccount, bulkAddPhotosAsAssistant, bulkUpdatePricingAsAssistant } from "@/lib/sales-actions";
import type { PriceAdjustment } from "@/lib/listings";

export async function editListingForAccount(sellerId: string, formData: FormData) {
  await handleEditListingFromAccount("sales_rep", "/sales/accounts", sellerId, formData);
}

export async function bulkAddPhotosForAccount(batchId: string, assignments: { listingId: string; url: string; contentType: string }[]) {
  return bulkAddPhotosAsAssistant("sales_rep", batchId, assignments);
}

export async function bulkUpdatePricingForAccount(batchId: string, adjustment: PriceAdjustment, listingIds?: string[]) {
  return bulkUpdatePricingAsAssistant("sales_rep", batchId, adjustment, listingIds);
}
