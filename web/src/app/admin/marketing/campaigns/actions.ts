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
} from "@/lib/lead-messaging";

const LIST_PATH = "/admin/marketing/campaigns";

export async function previewCampaignAction(templateText: string, leadIds: string[]) {
  const session = await requireRole("admin");
  const actor = { role: "admin" as const, id: session.user.id };
  if (leadIds.length > MAX_CAMPAIGN_LEADS) {
    throw new Error(`Select ${MAX_CAMPAIGN_LEADS} or fewer leads per campaign — split a larger send into more than one.`);
  }
  const { leads, excludedDnc, excludedNotVisible } = await resolveSelectableLeads(leadIds, actor);
  const result = await personalizeMessagesForLeads(templateText, leads);
  return {
    ...result,
    leadsById: Object.fromEntries(leads.map((l) => [l.id, l])),
    excludedDnc,
    excludedNotVisible,
  };
}

export async function createCampaignAction(
  templateText: string,
  items: { leadId: string; text: string }[],
  scheduledForIso: string | null,
  personalized: boolean
) {
  const session = await requireRole("admin");
  const actor = { role: "admin" as const, id: session.user.id };
  const scheduledFor = scheduledForIso ? new Date(scheduledForIso) : null;
  await createCampaign({ templateText, items, scheduledFor, personalized, actor });

  if (!scheduledFor) {
    after(async () => {
      await processDueCampaigns();
    });
  }

  revalidatePath(LIST_PATH);
  redirect(LIST_PATH);
}

export async function cancelCampaignAction(campaignId: string) {
  const session = await requireRole("admin");
  await cancelCampaign(campaignId, { role: "admin", id: session.user.id });
  revalidatePath(LIST_PATH);
}
