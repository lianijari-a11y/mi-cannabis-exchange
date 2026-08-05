"use server";

import Anthropic from "@anthropic-ai/sdk";
import { requireAuth } from "@/lib/dal";
import { CATEGORIES, TERMS, UNITS } from "@/lib/constants";

// Growers/processors/brokers post inventory constantly, often just pasting
// whatever raw text they already typed up (a text message, a spreadsheet
// row). This turns that raw text into structured Listing fields so sellers
// aren't hand-filling a form for every single item, several times a day.
//
// Per CLAUDE.md's AI-governance posture (borrowed from the LaneMatch pattern
// this codebase's conventions come from): the model only DRAFTS the fields.
// It never posts a listing itself — the seller reviews/edits the pre-filled
// form and submits it themselves, same as every other listing.
//
// ANTHROPIC_API_KEY is not configured by default (see .env.example) — without
// it this returns a clear "not configured" error instead of failing oddly,
// same fallback pattern as every other credential-gated feature.

const MODEL = "claude-opus-5";

export type ListingDraft = {
  strainName: string;
  category: (typeof CATEGORIES)[number];
  thcPercent: number | null;
  quantity: number | null;
  unit: (typeof UNITS)[number];
  pricePerUnit: number | null;
  terms: (typeof TERMS)[number];
  notes: string | null;
};

export type StructureResult = { ok: true; draft: ListingDraft } | { ok: false; error: string };

function systemPrompt() {
  return `You extract structured wholesale-cannabis listing data from raw, informal text a Grower/Processor/Broker pastes in (a text message, a spreadsheet row, shorthand notes). Output ONLY a single JSON object, no prose, no markdown fences, matching exactly this shape:

{
  "strainName": string,
  "category": one of ${JSON.stringify(CATEGORIES)},
  "thcPercent": number or null,
  "quantity": number or null,
  "unit": one of ${JSON.stringify(UNITS)} ("lb" for flower/weight, "liter" for liquid concentrate/oil, "unit" for countable items like vapes/edibles/pre-rolls),
  "pricePerUnit": number or null,
  "terms": one of ${JSON.stringify(TERMS)} (default "negotiable" if payment terms aren't mentioned; "cash" only if cash is explicitly stated; "net_30" only if 30-day terms are explicitly stated),
  "notes": string or null (anything relevant that doesn't fit the fields above, e.g. cultivar lineage, harvest date, packaging)
}

If a field truly can't be inferred, use null (or "other"/"negotiable" for the enum fields, never invent a specific number). Never fabricate a THC percentage, quantity, or price that isn't stated or clearly implied.`;
}

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function coerceDraft(raw: unknown): ListingDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const category = CATEGORIES.includes(r.category as (typeof CATEGORIES)[number])
    ? (r.category as (typeof CATEGORIES)[number])
    : "other";
  const unit = UNITS.includes(r.unit as (typeof UNITS)[number])
    ? (r.unit as (typeof UNITS)[number])
    : "lb";
  const terms = TERMS.includes(r.terms as (typeof TERMS)[number])
    ? (r.terms as (typeof TERMS)[number])
    : "negotiable";

  return {
    strainName: typeof r.strainName === "string" ? r.strainName : "",
    category,
    thcPercent: typeof r.thcPercent === "number" ? r.thcPercent : null,
    quantity: typeof r.quantity === "number" ? r.quantity : null,
    unit,
    pricePerUnit: typeof r.pricePerUnit === "number" ? r.pricePerUnit : null,
    terms,
    notes: typeof r.notes === "string" ? r.notes : null,
  };
}

export async function structureListingDraft(rawText: string): Promise<StructureResult> {
  await requireAuth();

  const trimmed = rawText.trim();
  if (!trimmed) return { ok: false, error: "Paste some inventory notes first." };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error:
        "AI structuring isn't configured yet — the platform owner needs to add an Anthropic API key. Fill in the fields below by hand for now.",
    };
  }

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 512,
      system: systemPrompt(),
      output_config: { effort: "low" },
      messages: [{ role: "user", content: trimmed }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (textBlock?.type !== "text") {
      return { ok: false, error: "Couldn't parse a response — try filling in the form by hand." };
    }

    const parsed = extractJson(textBlock.text);
    const draft = coerceDraft(parsed);
    if (!draft) {
      return { ok: false, error: "Couldn't structure that text — try filling in the form by hand." };
    }
    return { ok: true, draft };
  } catch {
    return { ok: false, error: "Something went wrong reaching the assistant. Try again shortly." };
  }
}
