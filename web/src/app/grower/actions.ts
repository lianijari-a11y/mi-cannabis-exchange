"use server";

import { handleBulkAddPhotos } from "@/lib/seller-actions";

export async function bulkAddPhotosAction(batchId: string, assignments: { listingId: string; file: File }[]) {
  return handleBulkAddPhotos("grower", batchId, assignments);
}
