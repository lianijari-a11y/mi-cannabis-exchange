"use server";

import {
  handleSellerRespond,
  handleUploadInvoice,
  handleSplitContractRespond,
} from "@/lib/seller-actions";

export async function respond(formData: FormData) {
  await handleSellerRespond("grower", formData);
}

export async function uploadInvoice(formData: FormData) {
  await handleUploadInvoice("grower", formData);
}

export async function splitContractRespond(formData: FormData) {
  await handleSplitContractRespond("grower", formData);
}
