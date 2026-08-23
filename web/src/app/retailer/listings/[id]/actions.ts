"use server";

import {
  handleRetailerRespond,
  handleAcceptInvoice,
  handleAcceptProduct,
  handleRejectProduct,
  handleChooseReturn,
  handleProposeRejectionCounter,
  handleAcceptShipmentSchedule,
  handleSetDeliveryInstructions,
  handleOptIntoAiNegotiation,
  handleTakeBackAiControl,
  handlePollAiNegotiation,
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

export async function chooseReturn(formData: FormData) {
  await handleChooseReturn(formData);
}

export async function proposeRejectionCounter(formData: FormData) {
  await handleProposeRejectionCounter(formData);
}

export async function acceptShipmentSchedule(formData: FormData) {
  await handleAcceptShipmentSchedule(formData);
}

export async function setDeliveryInstructions(formData: FormData) {
  await handleSetDeliveryInstructions(formData);
}

export async function optIntoAiNegotiation(formData: FormData) {
  await handleOptIntoAiNegotiation(formData);
}

export async function takeBackAiControl(formData: FormData) {
  await handleTakeBackAiControl(formData);
}

export async function pollAiNegotiation(threadId: string) {
  await handlePollAiNegotiation(threadId);
}
