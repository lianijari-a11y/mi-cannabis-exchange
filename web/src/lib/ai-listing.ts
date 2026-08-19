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
export type StructureBulkResult =
  | { ok: true; drafts: ListingDraft[] }
  | { ok: false; error: string };

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

// Same shape as systemPrompt(), but for a whole pasted menu/price list at
// once (e.g. a delivery's full strain list) rather than one product's
// notes — see CLAUDE.md, added after a real Account Executive paste of a
// 21-strain list broke the single-item structureListingDraft entirely.
function bulkSystemPrompt() {
  return `You extract structured wholesale-cannabis listing data from raw, informal text a Grower/Processor/Broker pastes in — this text describes MULTIPLE distinct products (a full price list or menu), not just one. Output ONLY a single JSON array, no prose, no markdown fences, with one object per distinct product mentioned, each matching exactly this shape:

{
  "strainName": string,
  "category": one of ${JSON.stringify(CATEGORIES)},
  "thcPercent": number or null,
  "quantity": number or null,
  "unit": one of ${JSON.stringify(UNITS)} ("lb" for flower/weight, "liter" for liquid concentrate/oil, "unit" for countable items like vapes/edibles/pre-rolls),
  "pricePerUnit": number or null,
  "terms": one of ${JSON.stringify(TERMS)} (default "negotiable" if payment terms aren't mentioned; "cash" only if cash is explicitly stated; "net_30" only if 30-day terms are explicitly stated),
  "notes": string or null
}

Extract EVERY distinct product mentioned as its own array entry — never merge, summarize, or skip any of them. If a field truly can't be inferred for an item, use null (or "other"/"negotiable" for the enum fields, never invent a specific number). Never fabricate a THC percentage, quantity, or price that isn't stated or clearly implied — a bare number next to a strain name is very often a weight, not a price, so only fill "pricePerUnit" when a currency figure is actually distinguishable from the quantity.`;
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

// Structures a whole pasted list into multiple drafts at once — the caller
// (ListingForm's bulk mode) is responsible for letting the seller review and
// edit every row before any of it actually posts, same "draft only, never
// auto-post" posture as the single-item structureListingDraft above.
export async function structureListingDraftsBulk(rawText: string): Promise<StructureBulkResult> {
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
      max_tokens: 4096,
      system: bulkSystemPrompt(),
      output_config: { effort: "low" },
      messages: [{ role: "user", content: trimmed }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (textBlock?.type !== "text") {
      return { ok: false, error: "Couldn't parse a response — try filling in the form by hand." };
    }

    const parsedArray = extractJsonArray(textBlock.text);
    if (!parsedArray) {
      return { ok: false, error: "Couldn't structure that list — try filling in the form by hand." };
    }

    const drafts = parsedArray
      .map((item) => coerceDraft(item))
      .filter((d): d is ListingDraft => d !== null && d.strainName.trim() !== "");

    if (drafts.length === 0) {
      return { ok: false, error: "Couldn't find any products in that text — try filling in the form by hand." };
    }

    return { ok: true, drafts };
  } catch {
    return { ok: false, error: "Something went wrong reaching the assistant. Try again shortly." };
  }
}

// Bulk photo matching for an already-posted menu — "if the picture is
// labeled with the product name, AI can match" (raised, then deferred
// during the cart-orders build; picked up now). Text-only: matches by
// FILENAME against the menu's own strain names, not by looking at image
// content — a filename like "blue-dream-2.jpg" is the actual signal a
// seller's own camera-roll naming gives us, and a text call is far cheaper
// than a vision call for every photo. The seller/AE always reviews and can
// reassign every match before anything uploads — same "drafts, never
// auto-acts" posture as structureListingDraft(sBulk).
export type PhotoMatch = { filename: string; matchedStrainName: string | null };
export type MatchPhotosResult = { ok: true; matches: PhotoMatch[] } | { ok: false; error: string };

export async function matchPhotosToMenu(filenames: string[], strainNames: string[]): Promise<MatchPhotosResult> {
  await requireAuth();
  if (filenames.length === 0) return { ok: false, error: "No photos to match." };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error: "AI matching isn't configured yet — assign each photo by hand below.",
    };
  }

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      output_config: { effort: "low" },
      system: `You match photo filenames to product names from a cannabis wholesale menu, using the filename text only (you cannot see the images). For each filename, pick the single best-matching product name from the given list, or null if nothing plausibly matches. Output ONLY a JSON array, no prose, one object per filename, in the same order given: [{"filename": "...", "matchedStrainName": "..." | null}]`,
      messages: [
        {
          role: "user",
          content: `Product names in this menu:\n${strainNames.map((s) => `- ${s}`).join("\n")}\n\nFilenames to match:\n${filenames.map((f) => `- ${f}`).join("\n")}`,
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (textBlock?.type !== "text") {
      return { ok: false, error: "Couldn't parse a response — assign each photo by hand below." };
    }
    const parsedArray = extractJsonArray(textBlock.text);
    if (!parsedArray) {
      return { ok: false, error: "Couldn't match those photos — assign each photo by hand below." };
    }

    const strainSet = new Set(strainNames);
    const matches: PhotoMatch[] = filenames.map((filename, i) => {
      const raw = parsedArray[i] as { matchedStrainName?: unknown } | undefined;
      const candidate = typeof raw?.matchedStrainName === "string" ? raw.matchedStrainName : null;
      return { filename, matchedStrainName: candidate && strainSet.has(candidate) ? candidate : null };
    });
    return { ok: true, matches };
  } catch {
    return { ok: false, error: "Something went wrong reaching the assistant — assign each photo by hand below." };
  }
}
