"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/dal";
import { setMetrcVendorApiKey, setMetrcUseSandbox } from "@/lib/metrc-integration";

export async function setMetrcVendorApiKeyAction(formData: FormData) {
  await requireRole("admin");
  await setMetrcVendorApiKey(String(formData.get("vendorApiKey") ?? ""));
  revalidatePath("/admin/metrc");
}

export async function setMetrcUseSandboxAction(formData: FormData) {
  await requireRole("admin");
  await setMetrcUseSandbox(formData.get("useSandbox") === "on");
  revalidatePath("/admin/metrc");
}
