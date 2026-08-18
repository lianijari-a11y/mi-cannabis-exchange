"use server";

import { handleCreateListingAsAssistant, handleCreateListingsAsAssistantBulk } from "@/lib/sales-actions";

export async function createListingAsSalesRep(formData: FormData) {
  await handleCreateListingAsAssistant("sales_rep", "/sales", formData);
}

export async function createListingsBulkAsSalesRep(formData: FormData) {
  await handleCreateListingsAsAssistantBulk("sales_rep", "/sales", formData);
}
