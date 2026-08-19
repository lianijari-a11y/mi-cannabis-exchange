"use server";

import { handleBulkAddPhotos, handleBulkUpdatePricing } from "@/lib/seller-actions";
import type { PriceAdjustment } from "@/lib/listings";

export async function bulkAddPhotosAction(batchId: string, assignments: { listingId: string; url: string; contentType: string }[]) {
  return handleBulkAddPhotos("grower", batchId, assignments);
}

export async function bulkUpdatePricingAction(batchId: string, adjustment: PriceAdjustment, listingIds?: string[]) {
  return handleBulkUpdatePricing("grower", batchId, adjustment, listingIds);
}
