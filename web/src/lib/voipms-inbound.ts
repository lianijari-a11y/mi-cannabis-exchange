import "server-only";
import { prisma } from "@/lib/prisma";
import { addLeadNote } from "@/lib/leads";

// Handles an inbound SMS reply from VoIP.ms — the other half of
// lib/voipms-sms.ts's outbound send. "Wrong number" blocks that specific
// phone number; "stop"/"do not call"/"unsubscribe" blocks the number AND
// flips the whole Lead to the DNC disposition (the real, platform-wide
// suppression signal — checked by sendSmsToLead before anything goes out
// again). This is the actual compliance mechanism the human asked for:
// texting a lead now has a real path for them to opt out, not just a
// send-and-forget.
//
// Known, stated gap: VoIP.ms's GET URL Callback isn't signed or otherwise
// verifiable — this endpoint has no session and can't confirm a request
// genuinely came from VoIP.ms. Worst case if someone found the URL and
// spoofed a request: a real lead's number gets incorrectly blocked (a
// nuisance, reversible by unblocking it by hand) — not a data leak, since
// this endpoint only ever writes a block flag, never reads or returns
// lead data. Flagged here rather than silently assumed safe — same
// posture the earlier Vonage integration documented for its own webhook.
function digitsOnly(s: string): string {
  return (s || "").replace(/\D/g, "");
}

function classifyReply(text: string): { block: boolean; dnc: boolean; reason: string } | null {
  const t = text.trim().toLowerCase();
  if (!t) return null;

  const stopWords = ["stop", "unsubscribe", "do not call", "don't call", "do not text", "don't text", "remove me"];
  if (stopWords.some((w) => t === w || t.includes(w))) {
    return { block: true, dnc: true, reason: "Replied STOP / do not call" };
  }

  const wrongNumberPhrases = ["wrong number", "wrong person", "not the right number", "no longer", "not this number"];
  if (wrongNumberPhrases.some((w) => t.includes(w))) {
    return { block: true, dnc: false, reason: "Replied wrong number" };
  }

  return null;
}

export type InboundResult =
  | { handled: true; leadId: string; blocked: boolean; dnc: boolean }
  | { handled: false; reason: string };

export async function processInboundSms(fromRaw: string, text: string): Promise<InboundResult> {
  const fromDigits = digitsOnly(fromRaw).slice(-10);
  if (fromDigits.length < 10) return { handled: false, reason: "No usable from-number in payload." };

  // Phone numbers are stored in whatever format they were imported in, so
  // matching has to compare digits-only on both sides — a straight SQL
  // equality on `phone` would miss "(313) 555-0100" vs "3135550100".
  const candidates = await prisma.leadPhoneNumber.findMany({ select: { id: true, leadId: true, phone: true } });
  const match = candidates.find((c) => digitsOnly(c.phone).slice(-10) === fromDigits);
  if (!match) return { handled: false, reason: `No lead found for ${fromDigits}.` };

  const classification = classifyReply(text);
  if (!classification) {
    // Not a recognized opt-out/wrong-number phrase — still worth logging
    // as a real reply so a rep sees it, but nothing gets auto-blocked off
    // an ambiguous message.
    await addLeadNote(match.leadId, `Received reply: "${text}"`);
    return { handled: true, leadId: match.leadId, blocked: false, dnc: false };
  }

  await prisma.leadPhoneNumber.update({
    where: { id: match.id },
    data: { blocked: true, blockedReason: classification.reason },
  });
  if (classification.dnc) {
    await prisma.lead.update({ where: { id: match.leadId }, data: { disposition: "DNC" } });
  }
  await addLeadNote(
    match.leadId,
    `Received reply: "${text}" — ${classification.reason}. ${
      classification.dnc ? "Lead marked Do Not Call." : "This number marked bad."
    }`
  );

  return { handled: true, leadId: match.leadId, blocked: true, dnc: classification.dnc };
}
