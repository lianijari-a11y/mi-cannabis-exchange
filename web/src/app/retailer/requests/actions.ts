"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/dal";
import { createProductRequest, closeProductRequest } from "@/lib/product-requests";
import type { Category, Terms } from "@/lib/constants";

export async function createRequest(formData: FormData) {
  const session = await requireRole("retailer");

  const category = String(formData.get("category") ?? "").trim();
  const termsPreference = String(formData.get("termsPreference") ?? "").trim();
  const targetPriceRaw = String(formData.get("targetPrice") ?? "").trim();

  await createProductRequest({
    retailerId: session.user.id,
    category: category ? (category as Category) : null,
    productName: String(formData.get("productName") ?? "").trim(),
    quantity: Number(formData.get("quantity")),
    unit: String(formData.get("unit") ?? "lb"),
    targetPrice: targetPriceRaw ? Number(targetPriceRaw) : null,
    termsPreference: termsPreference ? (termsPreference as Terms) : null,
    note: String(formData.get("note") ?? "").trim() || undefined,
  });

  revalidatePath("/retailer/requests");
}

export async function closeRequest(formData: FormData) {
  const session = await requireRole("retailer");
  await closeProductRequest(String(formData.get("requestId")), session.user.id);
  revalidatePath("/retailer/requests");
}
