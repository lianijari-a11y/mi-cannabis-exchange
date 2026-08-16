"use server";

import { handleSetCommission, handleMarkCommissionPaid } from "@/lib/broker-actions";

export async function setCommissionAction(formData: FormData) {
  await handleSetCommission(formData);
}

export async function markCommissionPaidAction(formData: FormData) {
  await handleMarkCommissionPaid(formData);
}
