"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/dal";
import {
  setLicenseVerification,
  setPreferredTransporter,
  setSalesRepCommissionRate,
  markSalesRepCommissionPaid,
} from "@/lib/admin";
import { resetUserPassword } from "@/lib/account-management";

export async function reviewLicense(formData: FormData) {
  await requireRole("admin");
  const userId = String(formData.get("userId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (decision !== "approved" && decision !== "rejected") return;
  await setLicenseVerification(userId, decision);
  revalidatePath("/admin");
}

export async function togglePreferredTransporter(formData: FormData) {
  await requireRole("admin");
  const userId = String(formData.get("userId") ?? "");
  const preferred = String(formData.get("preferred") ?? "") === "true";
  await setPreferredTransporter(userId, preferred);
  revalidatePath("/admin");
}

export async function setSalesRepRate(formData: FormData) {
  await requireRole("admin");
  const userId = String(formData.get("userId") ?? "");
  const rate = Number(formData.get("rate"));
  await setSalesRepCommissionRate(userId, rate);
  revalidatePath("/admin");
  revalidatePath("/admin/sales-reps");
}

export async function markSalesRepPaid(formData: FormData) {
  await requireRole("admin");
  await markSalesRepCommissionPaid(String(formData.get("commissionId")));
  revalidatePath("/admin/sales-reps");
}

// Admin can reset any user's password platform-wide — see
// lib/account-management.ts's resetUserPassword for why this exists at all
// (no self-serve "forgot password" flow anywhere in this app).
export async function resetUserPasswordAction(formData: FormData) {
  await requireRole("admin");
  const userId = String(formData.get("userId") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  try {
    await resetUserPassword("admin", userId, newPassword);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Couldn't reset password.";
    redirect(`/admin?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/admin");
  redirect("/admin?passwordReset=1");
}
