import { NextResponse } from "next/server";
import { processDueCampaigns } from "@/lib/lead-messaging";

// Vercel Cron (see vercel.json) hits this on a recurring schedule — the
// real mechanism that makes a LeadMessageCampaign scheduled for a future
// time (or a large "as soon as possible" one that didn't finish in its
// first best-effort pass) actually go out, since this app has no other
// background-job infrastructure anywhere. Vercel automatically attaches
// `Authorization: Bearer ${CRON_SECRET}` to its own cron invocations when
// that env var is set — checked here so this endpoint can't be triggered
// by anyone else who finds the URL (it sends real SMS and has no session
// to gate on, unlike every other write path in this app).
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  const result = await processDueCampaigns();
  return NextResponse.json({ ok: true, ...result });
}
