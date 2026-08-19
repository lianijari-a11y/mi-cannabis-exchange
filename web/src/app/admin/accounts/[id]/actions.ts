"use server";

import { handleEditListingFromAccount, bulkAddPhotosAsAssistant } from "@/lib/sales-actions";

export async function editListingForAccount(sellerId: string, formData: FormData) {
  await handleEditListingFromAccount("admin", "/admin/accounts", sellerId, formData);
}

export async function bulkAddPhotosForAccount(batchId: string, assignments: { listingId: string; url: string; contentType: string }[]) {
  return bulkAddPhotosAsAssistant("admin", batchId, assignments);
}
