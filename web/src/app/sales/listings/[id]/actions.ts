"use server";

import { handleEditListingAsAssistant } from "@/lib/sales-actions";

export async function editListing(formData: FormData) {
  await handleEditListingAsAssistant("sales_rep", "/sales/listings", formData);
}
