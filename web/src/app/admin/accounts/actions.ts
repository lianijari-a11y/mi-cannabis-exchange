"use server";

import { broadcastAllMenus, type BroadcastTargetRole } from "@/lib/menu-broadcast";

export async function broadcastMenusToRetailersAction() {
  return broadcastAllMenus("admin", "retailer" as BroadcastTargetRole);
}

export async function broadcastMenusToProcessorsAction() {
  return broadcastAllMenus("admin", "processor" as BroadcastTargetRole);
}
