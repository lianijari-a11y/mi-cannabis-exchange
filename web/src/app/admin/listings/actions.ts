"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/dal";
import { setListingVisibility } from "@/lib/admin";

export async function updateListingVisibility(formData: FormData) {
  await requireRole("admin");

  const listingId = String(formData.get("listingId"));
  const visibility = String(formData.get("visibility")) as "all" | "exclusive";
  const retailerIds = formData.getAll("retailerIds").map(String);

  await setListingVisibility(listingId, visibility, retailerIds);
  revalidatePath("/admin/listings");
}
