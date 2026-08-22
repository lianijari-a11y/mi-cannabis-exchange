"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/dal";
import {
  createLead,
  updateLead,
  setLeadDisposition,
  logLeadCall,
  addLeadNote,
  softDeleteLead,
  restoreLead,
  addLeadPhoneNumber,
  updateLeadPhoneNumber,
  removeLeadPhoneNumber,
  setLeadPhoneNumberPosition,
  type LeadListKey,
  type LeadDisposition,
} from "@/lib/leads";
import { lookupLeadContactInfo, applyLeadContactInfo } from "@/lib/lead-contact-lookup";
import { sendSmsToLead } from "@/lib/vonage-sms";
import { scheduleTextForLead } from "@/lib/lead-messaging";

const PATH = "/sales/marketing";

export async function lookupContactAction(id: string) {
  await requireRole("sales_rep");
  return lookupLeadContactInfo(id);
}

export async function applyContactInfoAction(id: string, phone: string | null, email: string | null) {
  await requireRole("sales_rep");
  const result = await applyLeadContactInfo(id, phone, email);
  revalidatePath(PATH);
  return result;
}

export async function createLeadAction(formData: FormData) {
  const session = await requireRole("sales_rep");
  await createLead({
    listKey: String(formData.get("listKey")) as LeadListKey,
    company: String(formData.get("company") ?? "").trim(),
    contact: String(formData.get("contact") ?? "").trim() || undefined,
    phone: String(formData.get("phone") ?? "").trim() || undefined,
    altPhone: String(formData.get("altPhone") ?? "").trim() || undefined,
    email: String(formData.get("email") ?? "").trim() || undefined,
    website: String(formData.get("website") ?? "").trim() || undefined,
    address: String(formData.get("address") ?? "").trim() || undefined,
    city: String(formData.get("city") ?? "").trim() || undefined,
    state: String(formData.get("state") ?? "").trim() || undefined,
    zip: String(formData.get("zip") ?? "").trim() || undefined,
    notes: String(formData.get("notes") ?? "").trim() || undefined,
    assignedRepName: session.user.name || session.user.email || undefined,
  });
  revalidatePath(PATH);
}

export async function updateLeadAction(id: string, fields: Parameters<typeof updateLead>[1]) {
  await requireRole("sales_rep");
  await updateLead(id, fields);
  revalidatePath(PATH);
}

export async function setDispositionAction(
  id: string,
  disposition: LeadDisposition,
  saleAmount?: number | null,
  callbackDate?: Date | null
) {
  const session = await requireRole("sales_rep");
  try {
    await setLeadDisposition(id, disposition, saleAmount, callbackDate, { role: "sales_rep", id: session.user.id });
  } catch (err) {
    revalidatePath(PATH);
    return { ok: false as const, error: err instanceof Error ? err.message : "Something went wrong." };
  }
  revalidatePath(PATH);
  return { ok: true as const };
}

export async function logCallAction(id: string) {
  const session = await requireRole("sales_rep");
  try {
    await logLeadCall(id, { role: "sales_rep", id: session.user.id });
  } catch (err) {
    revalidatePath(PATH);
    return { ok: false as const, error: err instanceof Error ? err.message : "Something went wrong." };
  }
  revalidatePath(PATH);
  return { ok: true as const };
}

export async function addNoteAction(id: string, text: string) {
  const session = await requireRole("sales_rep");
  await addLeadNote(id, text, session.user.id);
  revalidatePath(PATH);
}

export async function deleteLeadAction(id: string) {
  await requireRole("sales_rep");
  await softDeleteLead(id);
  revalidatePath(PATH);
}

export async function restoreLeadAction(id: string) {
  await requireRole("sales_rep");
  await restoreLead(id);
  revalidatePath(PATH);
}

export async function sendTextAction(id: string, text: string) {
  const session = await requireRole("sales_rep");
  const result = await sendSmsToLead(id, text, session.user.id, { role: "sales_rep", id: session.user.id });
  revalidatePath(PATH);
  return result;
}

export async function scheduleTextAction(id: string, text: string, scheduledForIso: string) {
  const session = await requireRole("sales_rep");
  try {
    await scheduleTextForLead(id, text, new Date(scheduledForIso), { role: "sales_rep", id: session.user.id });
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Something went wrong." };
  }
  revalidatePath(PATH);
  revalidatePath(`${PATH}/campaigns`);
  return { ok: true as const };
}

export async function addPhoneNumberAction(leadId: string, phone: string, name: string) {
  await requireRole("sales_rep");
  await addLeadPhoneNumber(leadId, phone, name);
  revalidatePath(PATH);
}

export async function updatePhoneNumberAction(id: string, phone: string, name: string) {
  await requireRole("sales_rep");
  await updateLeadPhoneNumber(id, phone, name);
  revalidatePath(PATH);
}

export async function removePhoneNumberAction(id: string) {
  await requireRole("sales_rep");
  await removeLeadPhoneNumber(id);
  revalidatePath(PATH);
}

export async function setPhoneNumberPositionAction(leadId: string, phoneNumberId: string, position: 0 | 1) {
  await requireRole("sales_rep");
  await setLeadPhoneNumberPosition(leadId, phoneNumberId, position);
  revalidatePath(PATH);
}
