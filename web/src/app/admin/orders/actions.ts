"use server";

import { requireRole } from "@/lib/dal";
import { cancelCartOrder } from "@/lib/cart-order-management";

export async function cancelOrderAction(cartOrderId: string) {
  const session = await requireRole("admin");
  return cancelCartOrder("admin", session.user.id, cartOrderId);
}
