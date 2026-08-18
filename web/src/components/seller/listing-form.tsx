"use client";

import { useState, useTransition } from "react";
import { Sparkles, X } from "lucide-react";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  EXPIRATION_OPTIONS,
  TERMS,
  TERMS_LABELS,
  UNITS,
} from "@/lib/constants";
import {
  structureListingDraft,
  structureListingDraftsBulk,
  type ListingDraft,
} from "@/lib/ai-listing";

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
  bulkAction,
  error,
  sellerPickerSlot,
}: {
  action: (formData: FormData) => void;
  // When provided, offers a "paste a whole list" mode that structures many
  // drafts at once via structureListingDraftsBulk instead of one — added
  // after a real Account Executive pasted a 21-strain price list into the
  // single-item flow and it broke (see CLAUDE.md). Only wired into the
  // Admin/Account Executive "post for a seller" pages for now, since that's
  // the demonstrated need — a Grower/Processor/Broker posting their own
  // inventory doesn't get this prop.
  bulkAction?: (formData: FormData) => void;
  error?: string;
  // Rendered as the first field inside the <form> — used by /sales and
  // /admin's "post on behalf of a seller" pages to inject a seller search
  // field ahead of the usual listing fields, without forking this whole
  // component. See CLAUDE.md §13.
  sellerPickerSlot?: React.ReactNode;
}) {
  const [rawNotes, setRawNotes] = useState("");
  const [draft, setDraft] = useState<ListingDraft>(EMPTY_DRAFT);
  const [aiError, setAiError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  const [bulkMode, setBulkMode] = useState(false);
  const [bulkDrafts, setBulkDrafts] = useState<ListingDraft[] | null>(null);

  function set<K extends keyof ListingDraft>(key: K, value: ListingDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function setBulkDraft<K extends keyof ListingDraft>(index: number, key: K, value: ListingDraft[K]) {
    setBulkDrafts((rows) =>
      rows ? rows.map((r, i) => (i === index ? { ...r, [key]: value } : r)) : rows
    );
  }

  function removeBulkDraft(index: number) {
    setBulkDrafts((rows) => (rows ? rows.filter((_, i) => i !== index) : rows));
  }

  function switchToBulk() {
    setAiError(undefined);
    setBulkDrafts(null);
    setBulkMode(true);
  }

  function switchToSingle() {
    setAiError(undefined);
    setBulkDrafts(null);
    setBulkMode(false);
  }

  function structureWithAi() {
    setAiError(undefined);
    if (bulkMode) {
      startTransition(async () => {
        const result = await structureListingDraftsBulk(rawNotes);
        if (!result.ok) {
          setAiError(result.error);
          return;
        }
        setBulkDrafts(result.drafts);
      });
      return;
    }
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

  const bulkValid =
    bulkDrafts !== null &&
    bulkDrafts.length > 0 &&
    bulkDrafts.every(
      (d) => d.strainName.trim() && (d.quantity ?? 0) > 0 && (d.pricePerUnit ?? 0) > 0
    );

  return (
    <div className="space-y-5 max-w-lg">
      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900 rounded-xl p-3">
        <div className="flex items-center justify-between gap-2">
          <label className={labelClass} htmlFor="rawNotes">
            {bulkMode
              ? "Paste a whole list — Claude will draft one row per product"
              : "Paste your inventory notes (optional) — Claude will fill in the fields below"}
          </label>
          {bulkAction &&
            (bulkMode ? (
              <button
                type="button"
                onClick={switchToSingle}
                className="text-[11px] text-green-700 dark:text-green-400 underline shrink-0"
              >
                Switch back to single item
              </button>
            ) : (
              <button
                type="button"
                onClick={switchToBulk}
                className="text-[11px] text-green-700 dark:text-green-400 underline shrink-0"
              >
                Have a whole price list? Switch to bulk import
              </button>
            ))}
        </div>
        <textarea
          id="rawNotes"
          rows={bulkMode ? 6 : 3}
          value={rawNotes}
          onChange={(e) => setRawNotes(e.target.value)}
          placeholder={
            bulkMode
              ? 'e.g. "Blue Dream 8 lbs\nWhite Truffle 10 lbs\nGeorgia Pie 12.7 lbs"'
              : 'e.g. "Blue Dream, 22.5% THC, 45 lbs, $1100/lb, cash only"'
          }
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

      <form action={bulkMode && bulkAction ? bulkAction : action} className="space-y-4">
        {sellerPickerSlot}

        {bulkMode ? (
          <>
            <input type="hidden" name="drafts" value={JSON.stringify(bulkDrafts ?? [])} />
            {bulkDrafts && bulkDrafts.length > 0 ? (
              <div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400">
                    <tr>
                      <th className="text-left font-medium px-2 py-1.5">Strain</th>
                      <th className="text-left font-medium px-2 py-1.5">Category</th>
                      <th className="text-left font-medium px-2 py-1.5">THC %</th>
                      <th className="text-left font-medium px-2 py-1.5">Qty</th>
                      <th className="text-left font-medium px-2 py-1.5">Unit</th>
                      <th className="text-left font-medium px-2 py-1.5">Price ($)</th>
                      <th className="px-2 py-1.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {bulkDrafts.map((d, i) => {
                      const rowInvalid = !d.strainName.trim() || !((d.quantity ?? 0) > 0) || !((d.pricePerUnit ?? 0) > 0);
                      return (
                        <tr
                          key={i}
                          className={`border-t border-gray-100 dark:border-gray-800 ${rowInvalid ? "bg-amber-50 dark:bg-amber-950/20" : ""}`}
                        >
                          <td className="px-2 py-1">
                            <input
                              value={d.strainName}
                              onChange={(e) => setBulkDraft(i, "strainName", e.target.value)}
                              className="w-28 border border-gray-300 dark:border-gray-700 rounded px-1.5 py-1 bg-transparent"
                            />
                          </td>
                          <td className="px-2 py-1">
                            <select
                              value={d.category}
                              onChange={(e) => setBulkDraft(i, "category", e.target.value as ListingDraft["category"])}
                              className="border border-gray-300 dark:border-gray-700 rounded px-1 py-1 bg-transparent"
                            >
                              {CATEGORIES.map((c) => (
                                <option key={c} value={c}>
                                  {CATEGORY_LABELS[c]}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-1">
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              max="100"
                              value={d.thcPercent ?? ""}
                              onChange={(e) => setBulkDraft(i, "thcPercent", e.target.value ? Number(e.target.value) : null)}
                              className="w-14 border border-gray-300 dark:border-gray-700 rounded px-1.5 py-1 bg-transparent"
                            />
                          </td>
                          <td className="px-2 py-1">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={d.quantity ?? ""}
                              onChange={(e) => setBulkDraft(i, "quantity", e.target.value ? Number(e.target.value) : null)}
                              className="w-16 border border-gray-300 dark:border-gray-700 rounded px-1.5 py-1 bg-transparent"
                            />
                          </td>
                          <td className="px-2 py-1">
                            <select
                              value={d.unit}
                              onChange={(e) => setBulkDraft(i, "unit", e.target.value as ListingDraft["unit"])}
                              className="border border-gray-300 dark:border-gray-700 rounded px-1 py-1 bg-transparent"
                            >
                              {UNITS.map((u) => (
                                <option key={u} value={u}>
                                  {u === "lb" ? "lb" : u === "liter" ? "L" : "unit"}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-1">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={d.pricePerUnit ?? ""}
                              onChange={(e) => setBulkDraft(i, "pricePerUnit", e.target.value ? Number(e.target.value) : null)}
                              className="w-16 border border-gray-300 dark:border-gray-700 rounded px-1.5 py-1 bg-transparent"
                            />
                          </td>
                          <td className="px-2 py-1">
                            <button
                              type="button"
                              onClick={() => removeBulkDraft(i)}
                              className="text-gray-400 hover:text-red-500"
                              aria-label={`Remove ${d.strainName || "row"}`}
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Paste your list above and click &quot;Structure with AI&quot; to draft rows here.
              </p>
            )}
            {bulkDrafts && bulkDrafts.length > 0 && !bulkValid && (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Rows highlighted above are missing a strain name, quantity, or price — fill them in
                or remove the row before posting.
              </p>
            )}
            <p className="text-[11px] text-gray-400">
              Bulk-posted listings don&apos;t carry photos — add those later from each listing&apos;s
              own detail page if needed.
            </p>
          </>
        ) : (
          <>
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
          </>
        )}

        <div>
          <label className={labelClass} htmlFor="expiresInHours">
            Listing{bulkMode ? "s expire" : " expires"} in
          </label>
          <select id="expiresInHours" name="expiresInHours" className={inputClass} defaultValue="168">
            {EXPIRATION_OPTIONS.map((opt) => (
              <option key={opt.label} value={opt.hours ?? ""}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {!bulkMode && (
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
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={bulkMode && !bulkValid}
          className="bg-green-700 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {bulkMode ? `Post ${bulkDrafts?.length ?? 0} listing${bulkDrafts?.length === 1 ? "" : "s"}` : "Post listing"}
        </button>
      </form>
    </div>
  );
}
