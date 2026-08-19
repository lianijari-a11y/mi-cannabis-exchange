"use server";

import { redirect } from "next/navigation";
import { handleCreateMenuCollection } from "@/lib/menu-collections";

export async function createCollectionAction(formData: FormData) {
  const id = await handleCreateMenuCollection(formData);
  redirect(`/sales/collections/${id}`);
}
