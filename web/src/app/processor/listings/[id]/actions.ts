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
  handleOptIntoAiNegotiation,
  handleTakeBackAiControl,
  handlePollAiNegotiation,
} from "@/lib/seller-actions";

export async function respond(formData: FormData) {
  await handleSellerRespond("processor", formData);
}

export async function uploadInvoice(formData: FormData) {
  await handleUploadInvoice("processor", formData);
}

export async function splitContractRespond(formData: FormData) {
  await handleSplitContractRespond("processor", formData);
}

export async function confirmListingFresh(formData: FormData) {
  await handleConfirmListingFresh("processor", formData);
}

export async function acceptShipmentSchedule(formData: FormData) {
  await handleAcceptShipmentSchedule("processor", formData);
}

export async function setPickupInstructions(formData: FormData) {
  await handleSetPickupInstructions("processor", formData);
}

export async function acceptRejectionCounter(formData: FormData) {
  await handleAcceptRejectionCounter("processor", formData);
}

export async function requireReturnInsteadOfCounter(formData: FormData) {
  await handleRequireReturnInsteadOfCounter("processor", formData);
}

export async function editListing(formData: FormData) {
  await handleEditListing("processor", formData);
}

export async function optIntoAiNegotiation(formData: FormData) {
  await handleOptIntoAiNegotiation("processor", formData);
}

export async function takeBackAiControl(formData: FormData) {
  await handleTakeBackAiControl("processor", formData);
}

export async function pollAiNegotiation(threadId: string) {
  await handlePollAiNegotiation("processor", threadId);
}
