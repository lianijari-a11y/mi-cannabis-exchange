"use server";

import { requireRole } from "@/lib/dal";
import { searchAssistableSellers } from "@/lib/sales-actions";

export async function searchSellersAction(query: string) {
  await requireRole("sales_rep");
  return searchAssistableSellers(query);
}
