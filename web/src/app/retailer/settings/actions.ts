"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { connectMetrc, disconnectMetrc } from "@/lib/metrc-integration";
import { setDefaultMarkupPercent, setStorefrontSlug, setLoyaltySettings, setDailyPurchaseLimitOz } from "@/lib/pos";
import { createBudtenderAccount, removeBudtenderAccount } from "@/lib/staff";

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

export async function setLoyaltySettingsAction(formData: FormData) {
  const session = await requireRole("retailer");
  const raw = String(formData.get("loyaltyPointsPerDollar") ?? "").trim();
  await setLoyaltySettings(session.user.id, raw ? Number(raw) : null);
  revalidatePath("/retailer/settings");
}

export async function setDailyPurchaseLimitAction(formData: FormData) {
  const session = await requireRole("retailer");
  const raw = String(formData.get("dailyPurchaseLimitOz") ?? "").trim();
  await setDailyPurchaseLimitOz(session.user.id, raw ? Number(raw) : null);
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

// Budtender staff accounts (CLAUDE.md §33) — only the Retailer owner can
// create/remove them, never a budtender themselves (requireRole("retailer")
// rejects a budtender session the same as any other page under
// /retailer/settings — see requirePosAccess in lib/dal.ts for the one
// exception, /retailer/pos itself).
export async function createBudtenderAction(formData: FormData) {
  const session = await requireRole("retailer");
  const fullName = String(formData.get("fullName") ?? "");
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  try {
    await createBudtenderAccount(session.user.id, { fullName, email, password });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Couldn't create that staff account.";
    redirect(`/retailer/settings?staffError=${encodeURIComponent(message)}`);
  }
  revalidatePath("/retailer/settings");
}

export async function removeBudtenderAction(formData: FormData) {
  const session = await requireRole("retailer");
  const budtenderId = String(formData.get("budtenderId") ?? "");
  await removeBudtenderAccount(session.user.id, budtenderId);
  revalidatePath("/retailer/settings");
}
