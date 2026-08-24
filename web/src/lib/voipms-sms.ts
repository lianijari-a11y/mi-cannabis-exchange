import "server-only";
import { prisma } from "@/lib/prisma";
import { addLeadNote, claimOrVerifyLeadAssignment } from "@/lib/leads";

// Real SMS sending to leads via VoIP.ms's REST API — replaces the earlier
// Vonage integration (CLAUDE.md §57), same B2B-outreach posture: distinct
// from lib/marketing-sms.ts's permanently-stub-only Twilio scaffolding,
// which texts end retail consumers this app isn't the system of record
// for. This is outreach to a licensed business's own listed contact
// number, a different regulatory bucket.
//
// VoIP.ms's real wire protocol (confirmed against the account's own WSDL
// export, independently against a working third-party integration, AND
// against the live account with a real getBalance call before this file
// was trusted — not guessed): plain HTTP GET/POST to
// https://voip.ms/api/v1/rest.php with api_username/api_password/method
// as query params — never an Authorization: Bearer header.
//
// A real, confirmed mix-up worth recording: the account handoff also
// included a long base64-looking value labeled "Bearer token... used by
// 3CX or a PBX to send SMS/MMS" — that is NOT this api_password. It
// authenticated as invalid_credentials against getBalance; the account's
// plain portal-style password authenticated correctly (confirmed via the
// same live call, which then correctly reported ip_not_enabled instead —
// see the IP-allowlist note below). The "bearer token" is presumably a
// separate SMPP/3CX-gateway credential this integration doesn't use at
// all, not the REST api_password.
//
// Known, real operational risk, not silently assumed away: VoIP.ms
// supports an account-wide API IP allowlist. This app runs on Vercel
// (serverless, no fixed outbound IP by default) — if that allowlist is
// enabled on the account, every call here will fail with an auth error
// until it's disabled or a static-egress-IP setup is added. Confirm in
// the VoIP.ms portal under Main Menu -> SOAP and REST API before relying
// on this in production.
const VOIPMS_API_USERNAME = process.env.VOIPMS_API_USERNAME;
const VOIPMS_API_PASSWORD = process.env.VOIPMS_API_PASSWORD;
const VOIPMS_DID = process.env.VOIPMS_DID;

const VOIPMS_REST_URL = "https://voip.ms/api/v1/rest.php";

export function isVoipmsConfigured(): boolean {
  return !!(VOIPMS_API_USERNAME && VOIPMS_API_PASSWORD && VOIPMS_DID);
}

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

export type SendResult = { ok: true; messageUUID: string } | { ok: false; error: string };

type VoipmsSmsResponse = { status: string; sms?: string | number };

// VoIP.ms's plain sendSMS caps a message at 160 characters; sendMMS allows
// up to 2048. Rather than let a longer AI-composed or hand-typed message
// silently truncate at the API layer, route to sendMMS automatically once
// it won't fit — same message, no photo/video attached, just the higher
// character ceiling. Only a message longer than even that is rejected
// outright rather than guessed at.
const SMS_MAX_LENGTH = 160;
const MMS_MAX_LENGTH = 2048;

async function callVoipmsSend(method: "sendSMS" | "sendMMS", dst: string, message: string): Promise<SendResult> {
  const params = new URLSearchParams({
    api_username: VOIPMS_API_USERNAME!,
    api_password: VOIPMS_API_PASSWORD!,
    method,
    did: VOIPMS_DID!,
    dst,
    message,
  });

  let response: Response;
  try {
    response = await fetch(`${VOIPMS_REST_URL}?${params.toString()}`, { method: "GET" });
  } catch {
    return { ok: false, error: "Couldn't reach VoIP.ms — network error." };
  }

  if (!response.ok) {
    return { ok: false, error: `VoIP.ms returned HTTP ${response.status}.` };
  }

  let body: VoipmsSmsResponse;
  try {
    body = await response.json();
  } catch {
    return { ok: false, error: "VoIP.ms returned an unexpected (non-JSON) response." };
  }

  if (body.status !== "success") {
    // VoIP.ms's own status strings are the real error detail (e.g.
    // "invalid_credentials", "missing_did") — surfaced as-is rather than
    // translated, so a real API-side problem isn't hidden behind a vague
    // "send failed" message.
    return { ok: false, error: `VoIP.ms: ${body.status || "send failed"}.` };
  }

  return { ok: true, messageUUID: String(body.sms ?? "") };
}

// Sends the text and logs it on the lead's own activity timeline
// (LeadActivityLog) — same place logLeadCall/addLeadNote already write
// to, so a text shows up in the same history a rep already checks before
// calling someone back. Looks the phone number up itself (rather than
// taking it as a param) so the action-layer callers stay thin — always
// texts whatever's currently on file for this lead, not a client-supplied
// number.
//
// Two independent suppression checks, both hard stops — see
// lib/voipms-inbound.ts for how they get set: the whole Lead flipped to
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
  if (!isVoipmsConfigured()) {
    return { ok: false, error: "Texting isn't configured yet — add VOIPMS_API_USERNAME/VOIPMS_API_PASSWORD/VOIPMS_DID." };
  }
  if (!text.trim()) return { ok: false, error: "Message can't be empty." };
  if (text.length > MMS_MAX_LENGTH) {
    return { ok: false, error: `Message is too long (${text.length} chars, max ${MMS_MAX_LENGTH}).` };
  }

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

  const method = text.length > SMS_MAX_LENGTH ? "sendMMS" : "sendSMS";
  const result = await callVoipmsSend(method, to, text);
  if (result.ok) {
    await addLeadNote(leadId, `Texted: "${text}"`, authorId);
  }
  return result;
}

// Click-to-call already exists in the Leads UI, independent of any SMS
// provider — each lead's phone number renders as a plain tel: link (opens
// the rep's own phone/softphone dialer) next to the existing "Log call"
// button, which already increments Lead.calledCount. VoIP.ms's own voice
// side (routed through the account's existing SIP sub-account/PBX setup)
// would be a separate, bigger build from SMS. Not done here; this module
// is SMS/MMS-only for now.
