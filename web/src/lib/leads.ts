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
//
// Visibility, updated 2026-08-21 — a confirmed reversal, not a silent
// change: originally every sales_rep and admin saw every lead across
// every list, with no per-rep ownership. The human asked directly for
// each AE to only see/call leads assigned to them; flagged back (this
// undoes a documented decision) and confirmed. Real ownership
// (Lead.assignedSalesRepId) is claimed automatically the first time an AE
// makes real contact — a call, a text, a disposition change — same
// "claim on first contact" mechanism already used for grower/processor
// accounts (User.assignedSalesRepId, §38), not a new pattern. An
// unclaimed lead stays visible to every AE until someone claims it;
// Admin's own view stays platform-wide and unrestricted, matching every
// other place Admin has unrestricted reach in this app.

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
// The real ownership check — mirrors lib/sales-actions.ts's
// claimOrVerifySellerAssignment exactly (same shape, same three
// outcomes), applied to Lead instead of User. Admin is always exempt,
// same as everywhere else Admin has unrestricted reach. Called from every
// "real contact" action below (logLeadCall, setLeadDisposition, and
// sendSmsToLead in lib/vonage-sms.ts) — never from a read path, since
// browsing/searching the list isn't "contact."
export async function claimOrVerifyLeadAssignment(
  leadId: string,
  actorRole: "sales_rep" | "admin",
  actorId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (actorRole === "admin") return { ok: true };
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { assignedSalesRepId: true } });
  if (!lead) return { ok: false, error: "Lead not found." };
  if (!lead.assignedSalesRepId) {
    await prisma.lead.update({ where: { id: leadId }, data: { assignedSalesRepId: actorId } });
    return { ok: true };
  }
  if (lead.assignedSalesRepId !== actorId) {
    return { ok: false, error: "This lead is already being worked by another Account Executive." };
  }
  return { ok: true };
}

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

// actorRole/actorId scope the result to one AE's own claimed leads plus
// every still-unclaimed one — omit both (or pass "admin") for the
// unrestricted, platform-wide view.
export async function leadsForList(
  listKey: LeadListKey,
  includeDeleted = false,
  actor?: { role: "sales_rep" | "admin"; id: string }
) {
  return prisma.lead.findMany({
    where: {
      listKey,
      ...(includeDeleted ? {} : { deleted: false }),
      ...(actor && actor.role === "sales_rep"
        ? { OR: [{ assignedSalesRepId: null }, { assignedSalesRepId: actor.id }] }
        : {}),
    },
    include: {
      activity: { orderBy: { createdAt: "desc" }, take: 5 },
      phoneNumbers: { orderBy: { sortOrder: "asc" } },
    },
    orderBy: { company: "asc" },
  });
}

export async function leadCountsByList(actor?: { role: "sales_rep" | "admin"; id: string }) {
  const rows = await prisma.lead.groupBy({
    by: ["listKey"],
    where: {
      deleted: false,
      ...(actor && actor.role === "sales_rep"
        ? { OR: [{ assignedSalesRepId: null }, { assignedSalesRepId: actor.id }] }
        : {}),
    },
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
  callbackDate?: Date | null,
  actor?: { role: "sales_rep" | "admin"; id: string }
) {
  if (actor) {
    const claim = await claimOrVerifyLeadAssignment(id, actor.role, actor.id);
    if (!claim.ok) throw new Error(claim.error);
  }
  await prisma.lead.update({
    where: { id },
    data: { disposition, saleAmount: saleAmount ?? null, callbackDate: callbackDate ?? null },
  });
}

export async function logLeadCall(id: string, actor?: { role: "sales_rep" | "admin"; id: string }) {
  if (actor) {
    const claim = await claimOrVerifyLeadAssignment(id, actor.role, actor.id);
    if (!claim.ok) throw new Error(claim.error);
  }
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

const MAX_PHONE_NUMBERS = 5;

// Keeps the legacy single Lead.phone field pointed at whatever's
// currently at sortOrder 0 — every existing phone-dependent path (search,
// the tel: click-to-call link, Vonage texting in lib/vonage-sms.ts) reads
// that one field and was never rewritten to look at the new list, so
// syncing it here is what makes "set as main" actually take effect
// everywhere else without touching any of those call sites.
async function syncLeadPhoneField(leadId: string) {
  const primary = await prisma.leadPhoneNumber.findFirst({
    where: { leadId },
    orderBy: { sortOrder: "asc" },
  });
  await prisma.lead.update({ where: { id: leadId }, data: { phone: primary?.phone ?? null } });
}

export async function leadPhoneNumbers(leadId: string) {
  return prisma.leadPhoneNumber.findMany({ where: { leadId }, orderBy: { sortOrder: "asc" } });
}

export async function addLeadPhoneNumber(leadId: string, phone: string, name?: string) {
  const trimmedPhone = phone.trim();
  if (!trimmedPhone) throw new Error("Enter a phone number.");
  const existing = await prisma.leadPhoneNumber.findMany({ where: { leadId } });
  if (existing.length >= MAX_PHONE_NUMBERS) {
    throw new Error(`A lead can have at most ${MAX_PHONE_NUMBERS} phone numbers.`);
  }
  const nextSortOrder = existing.length === 0 ? 0 : Math.max(...existing.map((p) => p.sortOrder)) + 1;
  await prisma.leadPhoneNumber.create({
    data: { leadId, phone: trimmedPhone, name: name?.trim() || null, sortOrder: nextSortOrder },
  });
  await syncLeadPhoneField(leadId);
}

export async function updateLeadPhoneNumber(id: string, phone: string, name?: string) {
  const trimmedPhone = phone.trim();
  if (!trimmedPhone) throw new Error("Enter a phone number.");
  const record = await prisma.leadPhoneNumber.update({
    where: { id },
    data: { phone: trimmedPhone, name: name?.trim() || null },
  });
  await syncLeadPhoneField(record.leadId);
}

export async function removeLeadPhoneNumber(id: string) {
  const record = await prisma.leadPhoneNumber.delete({ where: { id } });
  // Close the gap left behind so sortOrder stays a clean 0..N-1 sequence —
  // otherwise a later "set as main"/"set as 2nd" comparison against
  // sortOrder 0/1 could land on the wrong entry after a middle one's
  // removed.
  const remaining = await prisma.leadPhoneNumber.findMany({
    where: { leadId: record.leadId },
    orderBy: { sortOrder: "asc" },
  });
  await Promise.all(
    remaining.map((p, i) =>
      p.sortOrder === i ? Promise.resolve() : prisma.leadPhoneNumber.update({ where: { id: p.id }, data: { sortOrder: i } })
    )
  );
  await syncLeadPhoneField(record.leadId);
}

// "Set as main" / "set as 2nd choice" — moves the target number to the
// requested position (0 = main, 1 = second choice) and shifts whatever
// was already there down one slot, rather than a dedicated boolean flag
// per number. targetPosition is clamped to [0, current count - 1].
export async function setLeadPhoneNumberPosition(leadId: string, phoneNumberId: string, targetPosition: 0 | 1) {
  const numbers = await prisma.leadPhoneNumber.findMany({ where: { leadId }, orderBy: { sortOrder: "asc" } });
  const target = numbers.find((p) => p.id === phoneNumberId);
  if (!target) throw new Error("Phone number not found.");

  const withoutTarget = numbers.filter((p) => p.id !== phoneNumberId);
  const position = Math.min(targetPosition, withoutTarget.length);
  const reordered = [...withoutTarget.slice(0, position), target, ...withoutTarget.slice(position)];

  await Promise.all(
    reordered.map((p, i) =>
      p.sortOrder === i ? Promise.resolve() : prisma.leadPhoneNumber.update({ where: { id: p.id }, data: { sortOrder: i } })
    )
  );
  await syncLeadPhoneField(leadId);
}

export async function restoreLead(id: string) {
  await prisma.lead.update({ where: { id }, data: { deleted: false } });
}
