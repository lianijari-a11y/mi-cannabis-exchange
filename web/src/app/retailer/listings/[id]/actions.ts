"use server";

import {
  handleRetailerRespond,
  handleAcceptInvoice,
  handleAcceptProduct,
  handleRejectProduct,
} from "@/lib/retailer-actions";

export async function respond(formData: FormData) {
  await handleRetailerRespond(formData);
}

export async function acceptInvoice(formData: FormData) {
  await handleAcceptInvoice(formData);
}

export async function acceptProduct(formData: FormData) {
  await handleAcceptProduct(formData);
}

export async function rejectProduct(formData: FormData) {
  await handleRejectProduct(formData);
}
