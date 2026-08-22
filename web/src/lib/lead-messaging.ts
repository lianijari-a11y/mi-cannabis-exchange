import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { sendSmsToLead } from "@/lib/vonage-sms";

// "AI text message creator" — an AE/Admin writes one generic template,
// optionally has Claude draft a personalized version per selected lead,
// reviews/edits every line, then sends it either right away or scheduled
// for a specific future time ("a week from now"). Same "draft only, the
// human reviews before anything real happens" posture as
// lib/ai-listing.ts's structureListingDraftsBulk — nothing here is
// persisted as a real campaign until the reviewed array is explicitly
// submitted.
//
// This app has no background-job infrastructure anywhere else (documented
// gap — no SMS/push/email queue, no cron). A scheduled campaign needs a
// real mechanism to eventually fire without anyone visiting the page, so
// LeadMessageCampaign rows are picked up by processDueCampaigns, called
// both (a) once, best-effort, right after an immediate campaign is created
// (via after(), off the request's critical path) and (b) on a recurring
// schedule by /api/cron/send-scheduled-messages (Vercel Cron — see
// vercel.json). (b) is the durable backstop: it's what actually makes a
// future scheduledFor fire, and it's also what finishes off a large
// "immediate" campaign that didn't complete in its first pass.

const MODEL = "claude-opus-5";
const CHUNK_SIZE = 15; // leads per Claude call, bounds output tokens per request
const SEND_STAGGER_MS = 150; // small delay between sends so a big batch doesn't hammer Vonage
const MAX_MESSAGES_PER_RUN = 40; // per processDueCampaigns invocation — keeps one cron tick well inside a function's time budget

// A personalization preview runs synchronously in a Server Action (unlike
// the actual sending, which is bounded/batched via processDueCampaigns) —
// several hundred leads at CHUNK_SIZE sequential Claude calls risks the
// request itself timing out. Enforced in the compose action, not silently
// truncated: a selection over this asks the rep to split it into more
// than one campaign instead.
export const MAX_CAMPAIGN_LEADS = 150;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isMessagingAiConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export type SelectableLead = { id: string; company: string; contact: string | null };

// Leads an actor can actually target — same visibility rule as
// leadsForList (unclaimed + this AE's own claimed leads; Admin
// unrestricted), plus DNC leads dropped outright since sending to one
// would just be rejected at send time anyway. Returns how many were
// dropped for that reason so the compose UI can say so honestly instead
// of silently shrinking the list.
export async function resolveSelectableLeads(
  leadIds: string[],
  actor: { role: "sales_rep" | "admin"; id: string }
): Promise<{ leads: SelectableLead[]; excludedDnc: number; excludedNotVisible: number }> {
  if (leadIds.length === 0) return { leads: [], excludedDnc: 0, excludedNotVisible: 0 };
  const rows = await prisma.lead.findMany({
    where: { id: { in: leadIds }, deleted: false },
    select: { id: true, company: true, contact: true, disposition: true, assignedSalesRepId: true },
  });
  let excludedDnc = 0;
  let excludedNotVisible = 0;
  const leads: SelectableLead[] = [];
  for (const r of rows) {
    if (r.disposition === "DNC") {
      excludedDnc++;
      continue;
    }
    if (actor.role === "sales_rep" && r.assignedSalesRepId && r.assignedSalesRepId !== actor.id) {
      excludedNotVisible++;
      continue;
    }
    leads.push({ id: r.id, company: r.company, contact: r.contact });
  }
  return { leads, excludedDnc, excludedNotVisible };
}

export type PersonalizedDraft = { leadId: string; text: string };

function systemPrompt() {
  return `You personalize a generic outreach text message for a list of cannabis-industry business leads. You'll get a template message and a JSON array of leads, each with an "id", "company" name, and optionally a "contact" first/full name.

For each lead, lightly personalize the template — use their contact's first name if given (otherwise just address the company), reference the company name naturally if it fits. Do NOT invent any fact, detail, offer, price, or claim that isn't already in the template. Keep the core offer/call-to-action and roughly the same length as the template. Keep it as a real SMS text — no markdown, no emoji unless the template already has one.

Output ONLY a JSON array, no prose, no markdown fences, one object per lead in this exact shape:
[{"leadId": "<id>", "text": "<personalized message>"}]

Include every lead id you were given, exactly once each.`;
}

function extractJsonArray(text: string): unknown[] | null {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

// Never hard-fails except on an empty template — on any AI error/missing
// key, falls back to sending the literal template to everyone rather than
// blocking a plain, unpersonalized bulk send. The compose UI's own review
// table is the real safety net for catching a silent fallback (a
// fallback line just reads identically to the template).
export async function personalizeMessagesForLeads(
  templateText: string,
  leads: SelectableLead[]
): Promise<{ personalized: boolean; drafts: PersonalizedDraft[]; note?: string }> {
  const trimmed = templateText.trim();
  if (!trimmed || leads.length === 0) {
    return { personalized: false, drafts: [] };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      personalized: false,
      drafts: leads.map((l) => ({ leadId: l.id, text: trimmed })),
      note: "AI personalization isn't configured yet — the same message will go to everyone. Edit any line below by hand.",
    };
  }

  const client = new Anthropic({ apiKey });
  const drafts: PersonalizedDraft[] = [];
  let anyChunkFellBack = false;

  for (let i = 0; i < leads.length; i += CHUNK_SIZE) {
    const chunk = leads.slice(i, i + CHUNK_SIZE);
    try {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 4096,
        system: systemPrompt(),
        output_config: { effort: "low" },
        messages: [
          {
            role: "user",
            content: `Template: ${trimmed}\n\nLeads: ${JSON.stringify(
              chunk.map((l) => ({ id: l.id, company: l.company, contact: l.contact }))
            )}`,
          },
        ],
      });
      const textBlock = response.content.find((b) => b.type === "text");
      const parsed = textBlock?.type === "text" ? extractJsonArray(textBlock.text) : null;
      const byId = new Map<string, string>();
      if (parsed) {
        for (const item of parsed) {
          if (
            item &&
            typeof item === "object" &&
            "leadId" in item &&
            "text" in item &&
            typeof (item as Record<string, unknown>).leadId === "string" &&
            typeof (item as Record<string, unknown>).text === "string"
          ) {
            byId.set((item as { leadId: string }).leadId, (item as { text: string }).text);
          }
        }
      }
      for (const l of chunk) {
        const text = byId.get(l.id);
        if (text) {
          drafts.push({ leadId: l.id, text });
        } else {
          anyChunkFellBack = true;
          drafts.push({ leadId: l.id, text: trimmed });
        }
      }
    } catch {
      anyChunkFellBack = true;
      for (const l of chunk) drafts.push({ leadId: l.id, text: trimmed });
    }
  }

  return {
    personalized: !anyChunkFellBack,
    drafts,
    note: anyChunkFellBack
      ? "Some messages couldn't be personalized and were left as the plain template — check each line below."
      : undefined,
  };
}

export type CreateCampaignInput = {
  templateText: string;
  items: { leadId: string; text: string }[];
  scheduledFor: Date | null;
  personalized: boolean;
  actor: { role: "sales_rep" | "admin"; id: string };
};

export async function createCampaign(input: CreateCampaignInput) {
  const items = input.items.filter((i) => i.text.trim());
  if (items.length === 0) throw new Error("No messages to send — add at least one lead.");

  const campaign = await prisma.leadMessageCampaign.create({
    data: {
      createdByRole: input.actor.role,
      createdById: input.actor.id,
      templateText: input.templateText,
      personalized: input.personalized,
      scheduledFor: input.scheduledFor,
      status: "scheduled",
      items: { create: items.map((i) => ({ leadId: i.leadId, text: i.text })) },
    },
  });
  return campaign;
}

// "Text back" — a single-lead scheduled text, reachable right from the
// lead's own row alongside the disposition/call-logging controls (not the
// multi-lead campaign composer's several-step flow). Reuses createCampaign
// as-is rather than a second scheduling path — a one-lead campaign is
// still just a campaign, and it shows up in the same /marketing/campaigns
// history and gets picked up by the same processDueCampaigns loop
// (immediate best-effort pass + the daily cron backstop) as any other one.
export async function scheduleTextForLead(
  leadId: string,
  text: string,
  scheduledFor: Date,
  actor: { role: "sales_rep" | "admin"; id: string }
) {
  if (!text.trim()) throw new Error("Message can't be empty.");
  return createCampaign({
    templateText: text,
    items: [{ leadId, text: text.trim() }],
    scheduledFor,
    personalized: false,
    actor,
  });
}

export async function cancelCampaign(campaignId: string, actor: { role: "sales_rep" | "admin"; id: string }) {
  const campaign = await prisma.leadMessageCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new Error("Campaign not found.");
  if (actor.role === "sales_rep" && campaign.createdById !== actor.id) {
    throw new Error("You can only cancel a campaign you created.");
  }
  if (campaign.status !== "scheduled") {
    throw new Error("This campaign already started sending and can't be canceled.");
  }
  await prisma.$transaction([
    prisma.leadMessageCampaign.update({
      where: { id: campaignId },
      data: { status: "canceled", canceledAt: new Date() },
    }),
    prisma.leadMessageCampaignItem.updateMany({
      where: { campaignId, status: "pending" },
      data: { status: "canceled" },
    }),
  ]);
}

export async function campaignsForActor(actor: { role: "sales_rep" | "admin"; id: string }) {
  return prisma.leadMessageCampaign.findMany({
    where: actor.role === "sales_rep" ? { createdById: actor.id } : {},
    include: {
      items: {
        select: { id: true, status: true, lead: { select: { company: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

function classifyFailure(error: string): string {
  if (error.includes("Do Not Call")) return "skipped_dnc";
  if (error.includes("marked bad")) return "skipped_blocked";
  if (error.includes("already being worked by another")) return "skipped_claimed";
  return "failed";
}

// The one real send loop — reused by (a) the best-effort immediate pass
// right after an "as soon as possible" campaign is created and (b) the
// recurring cron. Processes up to `limit` pending items total, oldest
// due campaign first, so a huge campaign doesn't block a smaller one
// scheduled right behind it, and no single invocation runs unbounded.
export async function processDueCampaigns(limit = MAX_MESSAGES_PER_RUN): Promise<{ sent: number; failed: number; completedCampaigns: number }> {
  const now = new Date();
  const dueCampaigns = await prisma.leadMessageCampaign.findMany({
    where: {
      status: { in: ["scheduled", "sending"] },
      OR: [{ scheduledFor: null }, { scheduledFor: { lte: now } }],
    },
    orderBy: { createdAt: "asc" },
  });

  let sent = 0;
  let failed = 0;
  let completedCampaigns = 0;
  let budget = limit;

  for (const campaign of dueCampaigns) {
    if (budget <= 0) break;

    if (campaign.status === "scheduled") {
      await prisma.leadMessageCampaign.update({ where: { id: campaign.id }, data: { status: "sending" } });
    }

    const pendingItems = await prisma.leadMessageCampaignItem.findMany({
      where: { campaignId: campaign.id, status: "pending" },
      take: budget,
    });

    for (const item of pendingItems) {
      const result = await sendSmsToLead(item.leadId, item.text, campaign.createdById, {
        role: campaign.createdByRole as "sales_rep" | "admin",
        id: campaign.createdById,
      });
      if (result.ok) {
        await prisma.leadMessageCampaignItem.update({
          where: { id: item.id },
          data: { status: "sent", sentAt: new Date() },
        });
        sent++;
      } else {
        await prisma.leadMessageCampaignItem.update({
          where: { id: item.id },
          data: { status: classifyFailure(result.error), errorMessage: result.error },
        });
        failed++;
      }
      budget--;
      if (budget <= 0) break;
      await sleep(SEND_STAGGER_MS);
    }

    const remainingPending = await prisma.leadMessageCampaignItem.count({
      where: { campaignId: campaign.id, status: "pending" },
    });
    if (remainingPending === 0) {
      await prisma.leadMessageCampaign.update({
        where: { id: campaign.id },
        data: { status: "sent", sentAt: new Date() },
      });
      completedCampaigns++;
    }
  }

  return { sent, failed, completedCampaigns };
}
