"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { requireRole } from "@/lib/dal";
import {
  resolveSelectableLeads,
  personalizeMessagesForLeads,
  createCampaign,
  cancelCampaign,
  processDueCampaigns,
  MAX_CAMPAIGN_LEADS,
  type MessageChannel,
} from "@/lib/lead-messaging";

const LIST_PATH = "/sales/marketing/campaigns";

export async function previewCampaignAction(templateText: string, leadIds: string[], channel: MessageChannel = "sms") {
  const session = await requireRole("sales_rep");
  const actor = { role: "sales_rep" as const, id: session.user.id };
  if (leadIds.length > MAX_CAMPAIGN_LEADS) {
    throw new Error(`Select ${MAX_CAMPAIGN_LEADS} or fewer leads per campaign — split a larger send into more than one.`);
  }
  const { leads, excludedDnc, excludedNotVisible, excludedUnsubscribed } = await resolveSelectableLeads(
    leadIds,
    actor,
    channel
  );
  const result = await personalizeMessagesForLeads(templateText, leads, channel);
  return {
    ...result,
    leadsById: Object.fromEntries(leads.map((l) => [l.id, l])),
    excludedDnc,
    excludedNotVisible,
    excludedUnsubscribed,
  };
}

export async function createCampaignAction(
  templateText: string,
  items: { leadId: string; text: string }[],
  scheduledForIso: string | null,
  personalized: boolean,
  channel: MessageChannel = "sms",
  subject?: string
) {
  const session = await requireRole("sales_rep");
  const actor = { role: "sales_rep" as const, id: session.user.id };
  const scheduledFor = scheduledForIso ? new Date(scheduledForIso) : null;
  await createCampaign({ templateText, items, scheduledFor, personalized, actor, channel, subject });

  // Best-effort immediate send for an "as soon as possible" campaign — the
  // recurring Vercel Cron tick (vercel.json) is the durable backstop that
  // finishes this off if it's large or this pass fails/times out.
  if (!scheduledFor) {
    after(async () => {
      await processDueCampaigns();
    });
  }

  revalidatePath(LIST_PATH);
  redirect(LIST_PATH);
}

export async function cancelCampaignAction(campaignId: string) {
  const session = await requireRole("sales_rep");
  await cancelCampaign(campaignId, { role: "sales_rep", id: session.user.id });
  revalidatePath(LIST_PATH);
}
