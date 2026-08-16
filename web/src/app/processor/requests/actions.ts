"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/dal";
import { respondToProductRequest } from "@/lib/product-requests";

export async function respondToRequest(formData: FormData) {
  const session = await requireRole("processor");

  const listingId = String(formData.get("listingId") ?? "").trim();
  const priceRaw = String(formData.get("price") ?? "").trim();
  const quantityRaw = String(formData.get("quantity") ?? "").trim();

  await respondToProductRequest({
    requestId: String(formData.get("requestId")),
    supplierId: session.user.id,
    listingId: listingId || undefined,
    price: priceRaw ? Number(priceRaw) : undefined,
    quantity: quantityRaw ? Number(quantityRaw) : undefined,
    message: String(formData.get("message") ?? "").trim(),
  });

  revalidatePath("/processor/requests");
}
