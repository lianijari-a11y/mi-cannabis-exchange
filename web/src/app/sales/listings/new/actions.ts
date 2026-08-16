"use server";

import { handleCreateListingAsAssistant } from "@/lib/sales-actions";

export async function createListingAsSalesRep(formData: FormData) {
  await handleCreateListingAsAssistant("sales_rep", "/sales", formData);
}
