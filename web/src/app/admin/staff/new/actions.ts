"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { createStaffAccount } from "@/lib/admin";

export async function createStaff(formData: FormData) {
  await requireRole("admin");

  const roleRaw = String(formData.get("role") ?? "");
  if (roleRaw !== "broker" && roleRaw !== "sales_rep") {
    redirect(`/admin/staff/new?error=${encodeURIComponent("Choose an account type.")}`);
  }
  const role = roleRaw as "broker" | "sales_rep";

  const fullName = String(formData.get("fullName") ?? "").trim();
  const businessName = String(formData.get("businessName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const phone = String(formData.get("phone") ?? "").trim();

  if (!fullName || !email) {
    redirect(`/admin/staff/new?error=${encodeURIComponent("Name and email are required.")}`);
  }
  if (password !== confirmPassword) {
    redirect(`/admin/staff/new?error=${encodeURIComponent("Passwords don't match.")}`);
  }

  try {
    await createStaffAccount({ role, fullName, businessName, email, password, phone });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Couldn't create that account.";
    redirect(`/admin/staff/new?error=${encodeURIComponent(message)}`);
  }

  redirect("/admin?staffCreated=1");
}
