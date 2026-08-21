import { NextRequest, NextResponse } from "next/server";
import { processInboundSms } from "@/lib/vonage-inbound";

// Vonage's configured "Inbound URL" for the Messages API — set this
// deployment's URL (https://<domain>/api/vonage/inbound-sms) in the
// Vonage dashboard's application settings once deployed. No auth: Vonage
// calls this directly, unauthenticated, same as every other inbound
// webhook in the industry. See lib/vonage-inbound.ts's module comment for
// the known "not signature-verified" gap and why it's an acceptable
// tradeoff for what this endpoint can actually do (block a number, never
// read/return data).
//
// Vonage's Messages API inbound payload is JSON: { from: { number }, text,
// message_type, channel, ... }. Parsed defensively — a malformed or
// unexpected payload shape should 200 (so Vonage doesn't retry-storm) and
// just log, not throw.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const from: string = body?.from?.number ?? body?.from ?? body?.msisdn ?? "";
    const text: string = body?.text ?? body?.message?.content?.text ?? "";

    if (!from || !text) {
      return NextResponse.json({ ok: true, note: "No from/text in payload — ignored." });
    }

    const result = await processInboundSms(from, text);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    console.error("vonage inbound-sms webhook error:", err);
    // Still 200 — Vonage will retry a non-2xx response, and a malformed
    // payload retrying won't fix itself.
    return NextResponse.json({ ok: false, error: "Failed to process." });
  }
}
