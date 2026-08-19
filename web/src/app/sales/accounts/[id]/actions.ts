"use server";

import { handleEditListingFromAccount, bulkAddPhotosAsAssistant } from "@/lib/sales-actions";

export async function editListingForAccount(sellerId: string, formData: FormData) {
  await handleEditListingFromAccount("sales_rep", "/sales/accounts", sellerId, formData);
}

export async function bulkAddPhotosForAccount(batchId: string, assignments: { listingId: string; file: File }[]) {
  return bulkAddPhotosAsAssistant("sales_rep", batchId, assignments);
}
