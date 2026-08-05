"use server";

import { handleSellerRespond, handleUploadInvoice } from "@/lib/seller-actions";

export async function respond(formData: FormData) {
  await handleSellerRespond("processor", formData);
}

export async function uploadInvoice(formData: FormData) {
  await handleUploadInvoice("processor", formData);
}
