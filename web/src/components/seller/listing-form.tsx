"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  EXPIRATION_OPTIONS,
  TERMS,
  TERMS_LABELS,
  UNITS,
} from "@/lib/constants";
import { structureListingDraft, type ListingDraft } from "@/lib/ai-listing";

const inputClass =
  "w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm mt-1 bg-transparent";
const labelClass = "text-xs text-gray-500 dark:text-gray-400";

const EMPTY_DRAFT: ListingDraft = {
  strainName: "",
  category: "flower",
  thcPercent: null,
  quantity: null,
  unit: "lb",
  pricePerUnit: null,
  terms: "negotiable",
  notes: null,
};

// Sellers post inventory constantly — this lets them paste whatever raw
// notes they already have (a text message, a spreadsheet row) and have
// Claude draft the structured fields below. The draft only ever pre-fills
// the form; nothing posts until the seller reviews it and hits "Post
// listing" themselves (see lib/ai-listing.ts).
export function ListingForm({
  action,
  error,
}: {
  action: (formData: FormData) => void;
  error?: string;
}) {
  const [rawNotes, setRawNotes] = useState("");
  const [draft, setDraft] = useState<ListingDraft>(EMPTY_DRAFT);
  const [aiError, setAiError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  function set<K extends keyof ListingDraft>(key: K, value: ListingDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function structureWithAi() {
    setAiError(undefined);
    startTransition(async () => {
      const result = await structureListingDraft(rawNotes);
      if (!result.ok) {
        setAiError(result.error);
        return;
      }
      setDraft((d) => ({
        ...d,
        ...result.draft,
        strainName: result.draft.strainName || d.strainName,
      }));
    });
  }

  return (
    <div className="space-y-5 max-w-lg">
      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900 rounded-xl p-3">
        <label className={labelClass} htmlFor="rawNotes">
          Paste your inventory notes (optional) — Claude will fill in the fields below
        </label>
        <textarea
          id="rawNotes"
          rows={3}
          value={rawNotes}
          onChange={(e) => setRawNotes(e.target.value)}
          placeholder='e.g. "Blue Dream, 22.5% THC, 45 lbs, $1100/lb, cash only"'
          className={inputClass}
        />
        <button
          type="button"
          onClick={structureWithAi}
          disabled={pending || !rawNotes.trim()}
          className="mt-2 inline-flex items-center gap-1.5 bg-green-700 text-white rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50"
        >
          <Sparkles className="w-3.5 h-3.5" />
          {pending ? "Structuring..." : "Structure with AI"}
        </button>
        {aiError && <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">{aiError}</p>}
      </div>

      <form action={action} className="space-y-4">
        <div>
          <label className={labelClass} htmlFor="strainName">
            Strain / product name
          </label>
          <input
            id="strainName"
            name="strainName"
            required
            value={draft.strainName}
            onChange={(e) => set("strainName", e.target.value)}
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} htmlFor="category">
              Category
            </label>
            <select
              id="category"
              name="category"
              value={draft.category}
              onChange={(e) => set("category", e.target.value as ListingDraft["category"])}
              className={inputClass}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="thcPercent">
              THC %
            </label>
            <input
              id="thcPercent"
              name="thcPercent"
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={draft.thcPercent ?? ""}
              onChange={(e) => set("thcPercent", e.target.value ? Number(e.target.value) : null)}
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} htmlFor="quantity">
              Quantity
            </label>
            <input
              id="quantity"
              name="quantity"
              type="number"
              step="0.01"
              min="0"
              required
              value={draft.quantity ?? ""}
              onChange={(e) => set("quantity", e.target.value ? Number(e.target.value) : null)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="unit">
              Unit
            </label>
            <select
              id="unit"
              name="unit"
              value={draft.unit}
              onChange={(e) => set("unit", e.target.value as ListingDraft["unit"])}
              className={inputClass}
            >
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u === "lb" ? "Pounds" : u === "liter" ? "Liters" : "Units"}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} htmlFor="pricePerUnit">
              Price per unit ($)
            </label>
            <input
              id="pricePerUnit"
              name="pricePerUnit"
              type="number"
              step="0.01"
              min="0"
              required
              value={draft.pricePerUnit ?? ""}
              onChange={(e) => set("pricePerUnit", e.target.value ? Number(e.target.value) : null)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="terms">
              Terms offered
            </label>
            <select
              id="terms"
              name="terms"
              value={draft.terms}
              onChange={(e) => set("terms", e.target.value as ListingDraft["terms"])}
              className={inputClass}
            >
              {TERMS.map((t) => (
                <option key={t} value={t}>
                  {TERMS_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={labelClass} htmlFor="notes">
            Notes (optional)
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            value={draft.notes ?? ""}
            onChange={(e) => set("notes", e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="expiresInHours">
            Listing expires in
          </label>
          <select id="expiresInHours" name="expiresInHours" className={inputClass} defaultValue="168">
            {EXPIRATION_OPTIONS.map((opt) => (
              <option key={opt.label} value={opt.hours ?? ""}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="media">
            Photos / videos
          </label>
          <input
            id="media"
            name="media"
            type="file"
            accept="image/*,video/*"
            multiple
            className={`${inputClass} file:mr-3 file:rounded-md file:border-0 file:bg-green-700 file:text-white file:px-3 file:py-1.5 file:text-xs`}
          />
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <button
          type="submit"
          className="bg-green-700 text-white rounded-lg px-4 py-2 text-sm font-medium"
        >
          Post listing
        </button>
      </form>
    </div>
  );
}
