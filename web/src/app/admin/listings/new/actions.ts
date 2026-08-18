"use server";

import { handleCreateListingAsAssistant, handleCreateListingsAsAssistantBulk } from "@/lib/sales-actions";

export async function createListingAsAdmin(formData: FormData) {
  await handleCreateListingAsAssistant("admin", "/admin", formData);
}

export async function createListingsBulkAsAdmin(formData: FormData) {
  await handleCreateListingsAsAssistantBulk("admin", "/admin", formData);
}
