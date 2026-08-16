"use server";

import { handleCreateListingAsAssistant } from "@/lib/sales-actions";

export async function createListingAsAdmin(formData: FormData) {
  await handleCreateListingAsAssistant("admin", "/admin", formData);
}
