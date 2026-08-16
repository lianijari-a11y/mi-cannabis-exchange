"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/dal";
import { connectPos, disconnectPos, POS_VENDORS, type PosVendor } from "@/lib/pos-integration";
import { connectMetrc, disconnectMetrc } from "@/lib/metrc-integration";

export async function connectPosAction(formData: FormData) {
  const session = await requireRole("processor");
  const vendor = String(formData.get("vendor"));
  if (!POS_VENDORS.includes(vendor as PosVendor)) throw new Error("Unknown POS vendor.");
  await connectPos(session.user.id, vendor as PosVendor, String(formData.get("apiKey") ?? ""), formData.get("autoSyncEnabled") === "on");
  revalidatePath("/processor/settings");
}

export async function disconnectPosAction(_formData: FormData) {
  const session = await requireRole("processor");
  await disconnectPos(session.user.id);
  revalidatePath("/processor/settings");
}

export async function connectMetrcAction(formData: FormData) {
  const session = await requireRole("processor");
  await connectMetrc(session.user.id, String(formData.get("licenseNumber") ?? ""), String(formData.get("userApiKey") ?? ""));
  revalidatePath("/processor/settings");
}

export async function disconnectMetrcAction(_formData: FormData) {
  const session = await requireRole("processor");
  await disconnectMetrc(session.user.id);
  revalidatePath("/processor/settings");
}
