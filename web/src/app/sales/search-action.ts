"use server";

import { requireRole } from "@/lib/dal";
import { searchAssistableSellers } from "@/lib/sales-actions";

// Scoped to sellers this rep can actually work with (unclaimed, or already
// assigned to them) — CLAUDE.md §38. A different rep's claimed account
// shouldn't even surface as a pickable search result.
export async function searchSellersAction(query: string) {
  const session = await requireRole("sales_rep");
  return searchAssistableSellers(query, "sales_rep", session.user.id);
}
