"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/dal";
import { connectMetrc, disconnectMetrc } from "@/lib/metrc-integration";

export async function connectMetrcAction(formData: FormData) {
  const session = await requireRole("retailer");
  await connectMetrc(session.user.id, String(formData.get("licenseNumber") ?? ""), String(formData.get("userApiKey") ?? ""));
  revalidatePath("/retailer/settings");
}

export async function disconnectMetrcAction(_formData: FormData) {
  const session = await requireRole("retailer");
  await disconnectMetrc(session.user.id);
  revalidatePath("/retailer/settings");
}
