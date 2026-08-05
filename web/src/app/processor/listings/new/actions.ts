"use server";

import { handleCreateListing } from "@/lib/seller-actions";

export async function createListing(formData: FormData) {
  await handleCreateListing("processor", formData);
}
