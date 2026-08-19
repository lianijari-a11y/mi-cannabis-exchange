"use server";

import Anthropic from "@anthropic-ai/sdk";
import { requireAuth } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

// MI Processors/Dispensaries (CLAUDE.md §20) were populated straight from
// the state's own CRA license export, which carries no phone/email at all
// — every one of those ~1,700 records landed as disposition "NO_PHONE"
// with nothing to call. Rather than silently bulk-filling all of them via
// AI (real cost, and a wrong number handed to a rep with no review step is
// actively worse than no number), this is a per-lead, on-demand lookup the
// rep triggers themselves and reviews before it's saved — same "draft,
// never auto-apply" posture as lib/ai-listing.ts's listing structuring.
const MODEL = "claude-opus-5";

export type LeadContactLookupResult =
  | { ok: true; phone: string | null; email: string | null; source: string | null }
  | { ok: false; error: string };

export async function lookupLeadContactInfo(leadId: string): Promise<LeadContactLookupResult> {
  const session = await requireAuth();
  if (session.user.role !== "sales_rep" && session.user.role !== "admin") {
    return { ok: false, error: "Not authorized." };
  }

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return { ok: false, error: "Lead not found." };
  if (lead.listKey !== "mi_processors" && lead.listKey !== "mi_dispensaries") {
    return { ok: false, error: "Contact lookup is only available for MI Processors/Dispensaries." };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error: "AI lookup isn't configured yet — the platform owner needs to add an Anthropic API key.",
    };
  }

  const location = [lead.address, lead.city, lead.state, lead.zip].filter(Boolean).join(", ");
  const query = `Find a real, publicly listed phone number and email address for this Michigan licensed cannabis business:\n\nBusiness name: ${lead.company}\nAddress: ${location || "unknown"}\nMI license number: ${lead.license ?? "unknown"}\n\nSearch the web for their own official site, Google Business listing, or the state license record's own public contact info. Only return a phone/email you can actually attribute to a real source — never guess or fabricate one. Respond with ONLY a single JSON object, no prose, no markdown fences:\n{"phone": string or null, "email": string or null, "source": string or null (the URL or description of where you found it)}`;

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 1024,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }],
      messages: [{ role: "user", content: query }],
    });

    const textBlock = [...response.content].reverse().find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return { ok: false, error: "Couldn't get a response — try again shortly." };
    }

    const start = textBlock.text.indexOf("{");
    const end = textBlock.text.lastIndexOf("}");
    if (start === -1 || end === -1) {
      return { ok: false, error: "Couldn't find anything usable — try filling it in by hand." };
    }
    const parsed = JSON.parse(textBlock.text.slice(start, end + 1)) as {
      phone?: unknown;
      email?: unknown;
      source?: unknown;
    };

    return {
      ok: true,
      phone: typeof parsed.phone === "string" && parsed.phone.trim() ? parsed.phone.trim() : null,
      email: typeof parsed.email === "string" && parsed.email.trim() ? parsed.email.trim() : null,
      source: typeof parsed.source === "string" && parsed.source.trim() ? parsed.source.trim() : null,
    };
  } catch {
    return { ok: false, error: "Something went wrong reaching the assistant. Try again shortly." };
  }
}

// Only called after the rep reviews the lookup result and explicitly
// accepts it — never auto-applied. Also flips disposition off "NO_PHONE"
// once a phone is actually on file, since that disposition specifically
// means "nothing to call."
export async function applyLeadContactInfo(
  leadId: string,
  phone: string | null,
  email: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireAuth();
  if (session.user.role !== "sales_rep" && session.user.role !== "admin") {
    return { ok: false, error: "Not authorized." };
  }
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return { ok: false, error: "Lead not found." };

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      phone: phone || lead.phone,
      email: email || lead.email,
      disposition: lead.disposition === "NO_PHONE" && phone ? "NEW" : lead.disposition,
    },
  });
  return { ok: true };
}
