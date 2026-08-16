"use server";

import { requireRole } from "@/lib/dal";
import { searchAssistableSellers } from "@/lib/sales-actions";

export async function searchSellersAction(query: string) {
  await requireRole("admin");
  return searchAssistableSellers(query);
}
