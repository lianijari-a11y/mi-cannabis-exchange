import "server-only";
import { prisma } from "@/lib/prisma";
import type { LeadListKey, LeadDisposition } from "@/lib/leads-constants";

export type { LeadListKey, LeadDisposition } from "@/lib/leads-constants";
export {
  LEAD_LIST_KEYS,
  LEAD_LIST_LABELS,
  LEAD_DISPOSITIONS,
  LEAD_DISPOSITION_LABELS,
} from "@/lib/leads-constants";

// Phase 1 core CRM for the sales team's cold-calling lead lists — see
// CLAUDE.md and the Lead/LeadActivityLog schema comments for the "why".
// Every sales_rep and admin sees every lead across every list (the human's
// confirmed choice, not per-rep visibility silos).

// Strips punctuation and common business-entity suffixes so "Forever Home
// Grown, LLC" and "FOREVER HOME GROWN LLC" normalize to the same key — same
// logic already used by scripts/enrich-license-registry-phone.mjs to join
// the CRA registry and the Lead CRM export by name (the two datasets use
// incompatible license-number schemes, see CLAUDE.md §36).
function normalizeName(s: string | null | undefined): string {
  return (s || "")
    .toUpperCase()
    .replace(/[.,'"]/g, "")
    .replace(/\b(LLC|INC|CORP|CORPORATION|CO|COMPANY|LTD|LP|LLP)\b\.?/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Once a Sales Rep is assigned to a Grower/Processor (CLAUDE.md §38), best-
// effort note it on that business's own Lead Directory record too, so the
// two views agree on who's working an account. Matched by normalized
// business name — the only reliable join key across these two datasets —
// so this is best-effort, not guaranteed: a name that doesn't match closely
// enough (or isn't in the Lead Directory at all) silently finds nothing,
// which is fine, since the User.assignedSalesRepId field is the actual
// source of truth for the assignment itself; this is just a courtesy note.
export async function markLeadAssignedRep(businessName: string | null, repName: string): Promise<void> {
  const target = normalizeName(businessName);
  if (!target) return;
  const candidates = await prisma.lead.findMany({
    where: { deleted: false },
    select: { id: true, company: true },
  });
  const match = candidates.find((c) => normalizeName(c.company) === target);
  if (!match) return;
  await prisma.lead.update({ where: { id: match.id }, data: { assignedRepName: repName } });
}

export async function leadsForList(listKey: LeadListKey, includeDeleted = false) {
  return prisma.lead.findMany({
    where: { listKey, ...(includeDeleted ? {} : { deleted: false }) },
    include: { activity: { orderBy: { createdAt: "desc" }, take: 5 } },
    orderBy: { company: "asc" },
  });
}

export async function leadCountsByList() {
  const rows = await prisma.lead.groupBy({
    by: ["listKey"],
    where: { deleted: false },
    _count: true,
  });
  const counts: Record<string, number> = {};
  rows.forEach((r) => (counts[r.listKey] = r._count));
  return counts;
}

export async function createLead(params: {
  listKey: LeadListKey;
  company: string;
  contact?: string;
  phone?: string;
  altPhone?: string;
  email?: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  notes?: string;
  assignedRepName?: string;
}) {
  return prisma.lead.create({
    data: {
      listKey: params.listKey,
      company: params.company,
      contact: params.contact || null,
      phone: params.phone || null,
      altPhone: params.altPhone || null,
      email: params.email || null,
      website: params.website || null,
      address: params.address || null,
      city: params.city || null,
      state: params.state || null,
      zip: params.zip || null,
      notes: params.notes || null,
      assignedRepName: params.assignedRepName || null,
    },
  });
}

export async function updateLead(
  id: string,
  fields: Partial<{
    company: string;
    contact: string;
    phone: string;
    altPhone: string;
    email: string;
    website: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    license: string;
    licenseType: string;
    licenseStatus: string;
    serviceZone: string;
    notes: string;
    assignedRepName: string;
    primaryStatus: string;
    disposition: string;
    saleAmount: number | null;
    callbackDate: Date | null;
  }>
) {
  await prisma.lead.update({ where: { id }, data: fields });
}

export async function setLeadDisposition(
  id: string,
  disposition: LeadDisposition,
  saleAmount?: number | null,
  callbackDate?: Date | null
) {
  await prisma.lead.update({
    where: { id },
    data: { disposition, saleAmount: saleAmount ?? null, callbackDate: callbackDate ?? null },
  });
}

export async function logLeadCall(id: string) {
  await prisma.lead.update({
    where: { id },
    data: { calledCount: { increment: 1 }, lastCallAt: new Date() },
  });
}

export async function addLeadNote(id: string, text: string, authorId?: string) {
  await prisma.leadActivityLog.create({
    data: { leadId: id, text, authorId: authorId ?? null },
  });
}

export async function softDeleteLead(id: string) {
  await prisma.lead.update({ where: { id }, data: { deleted: true } });
}

export async function restoreLead(id: string) {
  await prisma.lead.update({ where: { id }, data: { deleted: false } });
}
