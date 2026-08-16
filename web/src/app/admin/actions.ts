"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/dal";
import {
  setLicenseVerification,
  setPreferredTransporter,
  setSalesRepCommissionRate,
  markSalesRepCommissionPaid,
} from "@/lib/admin";

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
