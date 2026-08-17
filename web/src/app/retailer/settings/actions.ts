"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { connectMetrc, disconnectMetrc } from "@/lib/metrc-integration";
import { setDefaultMarkupPercent, setStorefrontSlug } from "@/lib/pos";

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

export async function setDefaultMarkupAction(formData: FormData) {
  const session = await requireRole("retailer");
  const raw = String(formData.get("defaultMarkupPercent") ?? "").trim();
  await setDefaultMarkupPercent(session.user.id, raw ? Number(raw) : null);
  revalidatePath("/retailer/settings");
}

export async function setStorefrontSlugAction(formData: FormData) {
  const session = await requireRole("retailer");
  const slug = String(formData.get("storefrontSlug") ?? "");
  try {
    await setStorefrontSlug(session.user.id, slug);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Couldn't save that store link.";
    redirect(`/retailer/settings?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/retailer/settings");
}
