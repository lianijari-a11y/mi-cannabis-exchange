import { NextRequest, NextResponse } from "next/server";
import { processInboundSms } from "@/lib/voipms-inbound";

// VoIP.ms's "SMS/MMS URL Callback" (GET Request) — configure this
// deployment's URL in the account's DID settings (Message Service
// (SMS/MMS) section) as:
//   https://<domain>/api/voipms/inbound-sms?from={FROM}&message={MESSAGE}
// VoIP.ms substitutes the {FROM}/{MESSAGE} placeholders with the real
// values before making the request — no auth, VoIP.ms calls this
// directly, same as every other inbound SMS webhook in the industry. See
// lib/voipms-inbound.ts's module comment for the known "not
// signature-verified" gap.
//
// Chosen over VoIP.ms's newer "SMS/MMS Webhook URL" (POST, JSON) because
// this GET-callback contract is the one independently, multiply
// documented option — the JSON webhook's exact field names aren't
// reliably documented anywhere verifiable, and guessing wrong on a
// compliance-relevant feature (opt-out detection) is worse than using the
// less modern but confirmed-correct mechanism.
//
// VoIP.ms expects the literal plain-text response body "ok" — anything
// else (including a JSON body) is treated as a failed delivery and
// retried (if "URL Callback and Webhook URL Retrying" is enabled on the
// account) every 30 minutes.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from") ?? "";
    const text = searchParams.get("message") ?? "";

    if (!from || !text) {
      return new NextResponse("ok", { status: 200, headers: { "Content-Type": "text/plain" } });
    }

    await processInboundSms(from, text);
  } catch (err) {
    console.error("voip.ms inbound-sms webhook error:", err);
    // Still respond "ok" — retrying a malformed payload won't fix itself,
    // and this endpoint's only job is to acknowledge receipt.
  }

  return new NextResponse("ok", { status: 200, headers: { "Content-Type": "text/plain" } });
}
