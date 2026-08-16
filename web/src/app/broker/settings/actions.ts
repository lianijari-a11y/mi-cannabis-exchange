"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/dal";
import { connectPos, disconnectPos, POS_VENDORS, type PosVendor } from "@/lib/pos-integration";

export async function connectPosAction(formData: FormData) {
  const session = await requireRole("broker");
  const vendor = String(formData.get("vendor"));
  if (!POS_VENDORS.includes(vendor as PosVendor)) throw new Error("Unknown POS vendor.");
  await connectPos(session.user.id, vendor as PosVendor, String(formData.get("apiKey") ?? ""), formData.get("autoSyncEnabled") === "on");
  revalidatePath("/broker/settings");
}

export async function disconnectPosAction(_formData: FormData) {
  const session = await requireRole("broker");
  await disconnectPos(session.user.id);
  revalidatePath("/broker/settings");
}
