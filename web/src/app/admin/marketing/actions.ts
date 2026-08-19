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
  type LeadListKey,
  type LeadDisposition,
} from "@/lib/leads";
import { lookupLeadContactInfo, applyLeadContactInfo } from "@/lib/lead-contact-lookup";

const PATH = "/admin/marketing";

export async function lookupContactAction(id: string) {
  await requireRole("admin");
  return lookupLeadContactInfo(id);
}

export async function applyContactInfoAction(id: string, phone: string | null, email: string | null) {
  await requireRole("admin");
  const result = await applyLeadContactInfo(id, phone, email);
  revalidatePath(PATH);
  return result;
}

export async function createLeadAction(formData: FormData) {
  const session = await requireRole("admin");
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
  await requireRole("admin");
  await updateLead(id, fields);
  revalidatePath(PATH);
}

export async function setDispositionAction(
  id: string,
  disposition: LeadDisposition,
  saleAmount?: number | null,
  callbackDate?: Date | null
) {
  await requireRole("admin");
  await setLeadDisposition(id, disposition, saleAmount, callbackDate);
  revalidatePath(PATH);
}

export async function logCallAction(id: string) {
  await requireRole("admin");
  await logLeadCall(id);
  revalidatePath(PATH);
}

export async function addNoteAction(id: string, text: string) {
  const session = await requireRole("admin");
  await addLeadNote(id, text, session.user.id);
  revalidatePath(PATH);
}

export async function deleteLeadAction(id: string) {
  await requireRole("admin");
  await softDeleteLead(id);
  revalidatePath(PATH);
}

export async function restoreLeadAction(id: string) {
  await requireRole("admin");
  await restoreLead(id);
  revalidatePath(PATH);
}
