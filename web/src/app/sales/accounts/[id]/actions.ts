"use server";

import { handleEditListingFromAccount } from "@/lib/sales-actions";

export async function editListingForAccount(sellerId: string, formData: FormData) {
  await handleEditListingFromAccount(sellerId, formData);
}
