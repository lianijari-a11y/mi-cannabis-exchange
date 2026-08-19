"use server";

import { requireRole } from "@/lib/dal";
import { cancelCartOrder } from "@/lib/cart-order-management";

export async function cancelOrderAction(cartOrderId: string) {
  const session = await requireRole("sales_rep");
  return cancelCartOrder("sales_rep", session.user.id, cartOrderId);
}
