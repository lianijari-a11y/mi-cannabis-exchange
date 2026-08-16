"use server";

import { handleProposeSplitContract } from "@/lib/processor-actions";

export async function proposeSplit(formData: FormData) {
  await handleProposeSplitContract(formData);
}
