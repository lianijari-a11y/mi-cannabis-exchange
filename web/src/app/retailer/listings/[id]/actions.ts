"use server";

import { handleRetailerRespond, handleAcceptInvoice } from "@/lib/retailer-actions";

export async function respond(formData: FormData) {
  await handleRetailerRespond(formData);
}

export async function acceptInvoice(formData: FormData) {
  await handleAcceptInvoice(formData);
}
