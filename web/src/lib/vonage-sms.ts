import "server-only";
import { Vonage } from "@vonage/server-sdk";
import { Channels } from "@vonage/messages";
import { prisma } from "@/lib/prisma";
import { addLeadNote, claimOrVerifyLeadAssignment } from "@/lib/leads";

// Real SMS sending to leads via Vonage's Messages API — distinct from
// lib/marketing-sms.ts's Twilio scaffolding, which is *permanently*
// stub-only because that feature texts end retail consumers and this app
// isn't the system of record for their TCPA opt-in/opt-out. This one is
// B2B outreach to a licensed business's own listed contact number, a
// different regulatory bucket — flagged to the human before building, who
// confirmed proceeding. Same "not configured" honest-fallback convention
// as every other optional external API in this app either way.
const VONAGE_API_KEY = process.env.VONAGE_API_KEY;
const VONAGE_API_SECRET = process.env.VONAGE_API_SECRET;
const VONAGE_FROM_NUMBER = process.env.VONAGE_FROM_NUMBER;

export function isVonageConfigured(): boolean {
  return !!(VONAGE_API_KEY && VONAGE_API_SECRET && VONAGE_FROM_NUMBER);
}

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

export type SendResult = { ok: true; messageUUID: string } | { ok: false; error: string };

// Sends the text and logs it on the lead's own activity timeline
// (LeadActivityLog) — same place logLeadCall/addLeadNote already write
// to, so a text shows up in the same history a rep already checks before
// calling someone back. Looks the phone number up itself (rather than
// taking it as a param) so the action-layer callers stay thin — always
// texts whatever's currently on file for this lead, not a client-supplied
// number.
//
// Two independent suppression checks, both hard stops — see
// lib/vonage-inbound.ts for how they get set: the whole Lead flipped to
// the DNC disposition (an inbound "stop"/"do not call" reply), and the
// specific number marked blocked (an inbound "wrong number" reply, or
// also set alongside DNC on a stop reply). Checked here, not just at the
// UI layer, so there's no path — bulk send, single text, future
// AI-composer — that can accidentally re-contact a suppressed number.
export async function sendSmsToLead(
  leadId: string,
  text: string,
  authorId?: string,
  actor?: { role: "sales_rep" | "admin"; id: string }
): Promise<SendResult> {
  if (!VONAGE_API_KEY || !VONAGE_API_SECRET || !VONAGE_FROM_NUMBER) {
    return { ok: false, error: "Texting isn't configured yet — add VONAGE_API_KEY/SECRET/FROM_NUMBER." };
  }
  if (!text.trim()) return { ok: false, error: "Message can't be empty." };

  // Texting is real contact — same claim-on-first-contact check as
  // logLeadCall/setLeadDisposition, so a rep can't route around lead
  // ownership just by texting instead of calling.
  if (actor) {
    const claim = await claimOrVerifyLeadAssignment(leadId, actor.role, actor.id);
    if (!claim.ok) return { ok: false, error: claim.error };
  }

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: {
      phone: true,
      disposition: true,
      phoneNumbers: { where: { sortOrder: 0 }, select: { blocked: true, blockedReason: true } },
    },
  });
  if (lead?.disposition === "DNC") {
    return { ok: false, error: "This lead is marked Do Not Call — texting is blocked." };
  }
  const primary = lead?.phoneNumbers[0];
  if (primary?.blocked) {
    return { ok: false, error: `This number was marked bad (${primary.blockedReason ?? "blocked"}) — texting is blocked.` };
  }

  const to = digitsOnly(lead?.phone ?? "");
  if (to.length < 10) return { ok: false, error: "No valid phone number on file for this lead." };

  const vonage = new Vonage({ apiKey: VONAGE_API_KEY, apiSecret: VONAGE_API_SECRET });

  try {
    const { messageUUID } = await vonage.messages.send({
      messageType: "text",
      channel: Channels.SMS,
      text,
      to,
      from: VONAGE_FROM_NUMBER,
    });
    await addLeadNote(leadId, `Texted: "${text}"`, authorId);
    return { ok: true, messageUUID };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Send failed.";
    return { ok: false, error: message };
  }
}

// Click-to-call already exists in the Leads UI, independent of Vonage —
// each lead's phone number renders as a plain tel: link (opens the rep's
// own phone/softphone dialer) next to the existing "Log call" button,
// which already increments Lead.calledCount. Vonage's Voice API (an
// actual in-browser call connected through Vonage, with call recording
// and an answer/event webhook) would replace that tel: link, but it needs
// a publicly reachable callback URL — realistic once this is deployed,
// not from local dev — and is a separate, bigger build from SMS. Not done
// here; this module is SMS-only for now.
