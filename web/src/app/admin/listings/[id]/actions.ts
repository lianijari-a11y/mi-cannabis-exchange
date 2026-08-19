"use server";

import { handleEditListingAsAssistant } from "@/lib/sales-actions";

export async function editListing(formData: FormData) {
  await handleEditListingAsAssistant("admin", "/admin/listings", formData);
}
