"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/dal";
import { setMetrcVendorApiKey } from "@/lib/metrc-integration";

export async function setMetrcVendorApiKeyAction(formData: FormData) {
  await requireRole("admin");
  await setMetrcVendorApiKey(String(formData.get("vendorApiKey") ?? ""));
  revalidatePath("/admin/metrc");
}
