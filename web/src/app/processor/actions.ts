"use server";

import { handleBulkAddPhotos } from "@/lib/seller-actions";

export async function bulkAddPhotosAction(batchId: string, assignments: { listingId: string; url: string; contentType: string }[]) {
  return handleBulkAddPhotos("processor", batchId, assignments);
}
