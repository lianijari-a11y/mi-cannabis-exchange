"use server";

import {
  handleSellerRespond,
  handleUploadInvoice,
  handleSplitContractRespond,
  handleConfirmListingFresh,
  handleAcceptShipmentSchedule,
  handleSetPickupInstructions,
  handleAcceptRejectionCounter,
  handleRequireReturnInsteadOfCounter,
  handleEditListing,
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

export async function confirmListingFresh(formData: FormData) {
  await handleConfirmListingFresh("grower", formData);
}

export async function acceptShipmentSchedule(formData: FormData) {
  await handleAcceptShipmentSchedule("grower", formData);
}

export async function setPickupInstructions(formData: FormData) {
  await handleSetPickupInstructions("grower", formData);
}

export async function acceptRejectionCounter(formData: FormData) {
  await handleAcceptRejectionCounter("grower", formData);
}

export async function requireReturnInsteadOfCounter(formData: FormData) {
  await handleRequireReturnInsteadOfCounter("grower", formData);
}

export async function editListing(formData: FormData) {
  await handleEditListing("grower", formData);
}
