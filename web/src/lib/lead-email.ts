import "server-only";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { sendEmail, isEmailConfigured } from "@/lib/email";
import { addLeadNote, claimOrVerifyLeadAssignment } from "@/lib/leads";

// Real marketing email to leads, alongside the existing real Vonage SMS
// (lib/vonage-sms.ts, CLAUDE.md §57). Reuses the same Resend account
// already wired up for password-reset email (lib/email.ts) — same
// "not configured" honest-fallback convention.
//
// CAN-SPAM (the real US law governing commercial email, distinct from
// TCPA's consent rules for SMS/calls) requires every commercial email to
// carry a working unsubscribe mechanism and the sender's real physical
// mailing address. Both are appended here, server-side, to every send —
// never something the compose UI can omit or edit — so compliance can't
// depend on whoever wrote a given campaign remembering to include it.
const BUSINESS_MAILING_ADDRESS = "2680 S Division Ave, Grand Rapids, MI 49507";

export { isEmailConfigured };

// A single persistent unsubscribe link per lead, not a stored-per-send
// token — computed deterministically (HMAC over the lead id, keyed by
// the same NEXTAUTH_SECRET every other token in this app already trusts)
// rather than a new DB column, so no extra state to manage and the same
// link keeps working across every future email to that lead.
function unsubscribeToken(leadId: string): string {
  const secret = process.env.NEXTAUTH_SECRET || "";
  return crypto.createHmac("sha256", secret).update(leadId).digest("hex").slice(0, 24);
}

function verifyUnsubscribeToken(leadId: string, token: string): boolean {
  const expected = unsubscribeToken(leadId);
  if (expected.length !== token.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token));
}

export function unsubscribeUrl(leadId: string): string {
  const base = process.env.NEXTAUTH_URL || "http://localhost:3000";
  return `${base}/unsubscribe/${leadId}?token=${unsubscribeToken(leadId)}`;
}

// The unsubscribe page itself does the real GET-doesn't-mutate confirm
// step (a known issue with bare-GET unsubscribe links: some corporate
// email security scanners "click" every link in a delivered email,
// including unsubscribe ones, which would silently unsubscribe someone
// who never asked to be) — this function is only ever called from that
// page's own confirm action (a real POST), not from the link's GET.
export async function unsubscribeLead(leadId: string, token: string): Promise<{ ok: boolean; error?: string }> {
  if (!verifyUnsubscribeToken(leadId, token)) return { ok: false, error: "Invalid or expired unsubscribe link." };
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true } });
  if (!lead) return { ok: false, error: "Lead not found." };
  await prisma.lead.update({ where: { id: leadId }, data: { emailUnsubscribedAt: new Date() } });
  return { ok: true };
}

function wrapWithFooter(bodyHtml: string, bodyText: string, leadId: string) {
  const url = unsubscribeUrl(leadId);
  const html =
    bodyHtml.replace(/\n/g, "<br/>") +
    `<hr style="margin-top:24px;border:none;border-top:1px solid #ddd"/>` +
    `<p style="font-size:11px;color:#888">${BUSINESS_MAILING_ADDRESS}<br/>` +
    `Don't want these emails? <a href="${url}">Unsubscribe</a>.</p>`;
  const text = `${bodyText}\n\n---\n${BUSINESS_MAILING_ADDRESS}\nUnsubscribe: ${url}`;
  return { html, text };
}

export type SendLeadEmailResult = { ok: true } | { ok: false; error: string };

// Mirrors lib/vonage-sms.ts's sendSmsToLead as closely as possible —
// same claim-on-first-contact ownership check, same suppression checks
// (DNC as a courtesy carryover from phone/SMS opt-out, plus the
// email-specific unsubscribe), same activity-log entry — just a
// different channel and a mandatory compliance footer.
export async function sendEmailToLead(
  leadId: string,
  subject: string,
  body: string,
  authorId?: string,
  actor?: { role: "sales_rep" | "admin"; id: string }
): Promise<SendLeadEmailResult> {
  if (!isEmailConfigured()) {
    return { ok: false, error: "Email isn't configured yet — add RESEND_API_KEY." };
  }
  if (!subject.trim()) return { ok: false, error: "Subject can't be empty." };
  if (!body.trim()) return { ok: false, error: "Message can't be empty." };

  if (actor) {
    const claim = await claimOrVerifyLeadAssignment(leadId, actor.role, actor.id);
    if (!claim.ok) return { ok: false, error: claim.error };
  }

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { email: true, disposition: true, emailUnsubscribedAt: true },
  });
  if (lead?.disposition === "DNC") {
    return { ok: false, error: "This lead is marked Do Not Call — emailing is blocked too." };
  }
  if (lead?.emailUnsubscribedAt) {
    return { ok: false, error: "This lead unsubscribed from email — can't send." };
  }
  const to = lead?.email?.trim();
  if (!to) return { ok: false, error: "No email address on file for this lead." };

  const { html, text } = wrapWithFooter(body, body, leadId);
  const result = await sendEmail(to, subject, html, text);
  if (!result.ok) return result;

  await addLeadNote(leadId, `Emailed ("${subject}"): "${body}"`, authorId);
  return { ok: true };
}
