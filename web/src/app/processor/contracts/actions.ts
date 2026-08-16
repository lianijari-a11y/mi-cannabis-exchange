"use server";

import {
  handleStartProcessing,
  handleLogYield,
  handleSettleContract,
} from "@/lib/processor-actions";

export async function startProcessingAction(formData: FormData) {
  await handleStartProcessing(formData);
}

export async function logYieldAction(formData: FormData) {
  await handleLogYield(formData);
}

export async function settleContractAction(formData: FormData) {
  await handleSettleContract(formData);
}
