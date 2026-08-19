"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DollarSign } from "lucide-react";

type ListingOption = { id: string; strainName: string; pricePerUnit: number; quantity: number; unit: string };
type PriceAdjustment =
  | { mode: "percent"; value: number }
  | { mode: "dollar"; value: number }
  | { mode: "targetTotal"; value: number }
  | { mode: "setPrice"; value: number };
type SaveResult = { ok: true; updatedCount: number } | { ok: false; error: string };

const money = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD" });

// "Need a way to do bulk price change, by percentage, or dollar amount"
// — plus a follow-up the same conversation: "a total dollar amount for
// the entire menu, without having to go product by product," and later
// "change pricing based on a percentage or change to a set price on all."
// Four modes, one tool. Percent/dollar move every price relative to what
// it already was; set-price overrides every selected line to the exact
// same number regardless of its old price; target-total scales every
// price by the same factor so the new sum lands on the requested total
// (proportional, not an equal split across products — see
// lib/listings.ts's bulkUpdatePricing for why).
//
// A later follow-up, once a real 34-product menu was being managed this
// way: "if there are 34 products and I feel like updating pricing I
// should be able to select all or select the products I want to update"
// — this used to always apply to every active listing in the menu with no
// way to scope it down. Every product starts checked (so the common case
// — "change the whole menu" — is still zero extra clicks), with a
// checklist to uncheck specific ones or a Select all/none shortcut.
export function BulkPriceUpdate({
  batchId,
  listings,
  saveAction,
}: {
  batchId: string;
  listings: ListingOption[];
  saveAction: (batchId: string, adjustment: PriceAdjustment, listingIds?: string[]) => Promise<SaveResult>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<PriceAdjustment["mode"]>("percent");
  const [value, setValue] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set(listings.map((l) => l.id)));
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<SaveResult | null>(null);

  const selectedListings = useMemo(() => listings.filter((l) => selected.has(l.id)), [listings, selected]);
  const allSelected = selectedListings.length === listings.length;
  const noneSelected = selectedListings.length === 0;

  const currentTotal = useMemo(
    () => selectedListings.reduce((sum, l) => sum + l.pricePerUnit * l.quantity, 0),
    [selectedListings]
  );

  const numValue = Number(value);
  const validValue =
    value.trim() !== "" &&
    Number.isFinite(numValue) &&
    (mode !== "targetTotal" || numValue > 0) &&
    (mode !== "setPrice" || numValue > 0) &&
    !noneSelected;

  const previewTotal = useMemo(() => {
    if (!validValue) return currentTotal;
    if (mode === "targetTotal") return numValue;
    return selectedListings.reduce((sum, l) => {
      const newPrice =
        mode === "percent"
          ? l.pricePerUnit * (1 + numValue / 100)
          : mode === "dollar"
            ? l.pricePerUnit + numValue
            : numValue; // setPrice — every selected line goes to the same exact number
      return sum + Math.max(0.01, newPrice) * l.quantity;
    }, 0);
  }, [selectedListings, mode, numValue, validValue, currentTotal]);

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save() {
    if (!validValue) return;
    setSaving(true);
    setResult(null);
    const r = await saveAction(batchId, { mode, value: numValue } as PriceAdjustment, Array.from(selected));
    setSaving(false);
    setResult(r);
    // Without this, the "Menu value" preview above and every price shown on
    // the listing cards below stay stale after a successful save — the
    // server mutation itself is always correct (bulkUpdatePricing re-reads
    // fresh prices from the DB every call), but this component's own
    // `listings` prop is a one-time snapshot from the server render that
    // never re-fetches on its own. Caught live: applying a second bulk
    // change right after the first computed its preview off the pre-update
    // numbers. Same fix already used for CancelOrderButton (CLAUDE.md §42D).
    if (r.ok) {
      setValue("");
      router.refresh();
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="inline-flex items-center gap-1.5 text-[11px] text-green-700 dark:text-green-400 border border-green-200 dark:border-green-900 rounded-full px-2 py-0.5 shrink-0"
      >
        <DollarSign className="w-3 h-3" /> Bulk price change
      </button>
    );
  }

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="mt-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">Bulk price change</h4>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-gray-400 underline">
          Close
        </button>
      </div>

      <div className="flex gap-1.5 mb-3">
        {(
          [
            { key: "percent", label: "Percentage" },
            { key: "dollar", label: "Dollar amount" },
            { key: "setPrice", label: "Set price" },
            { key: "targetTotal", label: "Target total for menu" },
          ] as const
        ).map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => {
              setMode(m.key);
              setValue("");
              setResult(null);
            }}
            className={`text-xs rounded-full px-2.5 py-1 border ${
              mode === m.key
                ? "bg-green-700 text-white border-green-700"
                : "border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 mb-1">
        {mode !== "targetTotal" && <span className="text-sm text-gray-500 dark:text-gray-400">{mode === "percent" ? "" : "$"}</span>}
        <input
          type="number"
          step={mode === "percent" ? "1" : "0.01"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={
            mode === "percent"
              ? "e.g. 10 for +10%, -10 for -10%"
              : mode === "dollar"
                ? "e.g. 5 for +$5/unit, -5 for -$5/unit"
                : mode === "setPrice"
                  ? "e.g. 150 to set every selected product to $150/unit"
                  : "e.g. 50000"
          }
          className="flex-1 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-transparent"
        />
        {mode === "percent" && <span className="text-sm text-gray-500 dark:text-gray-400">%</span>}
      </div>

      <div className="flex items-center justify-between mt-3 mb-1.5">
        <p className="text-[11px] text-gray-400">
          {selectedListings.length} of {listings.length} product{listings.length === 1 ? "" : "s"} selected
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSelected(new Set(listings.map((l) => l.id)))}
            disabled={allSelected}
            className="text-[11px] text-green-700 dark:text-green-400 underline disabled:no-underline disabled:text-gray-300 dark:disabled:text-gray-600"
          >
            Select all
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            disabled={noneSelected}
            className="text-[11px] text-green-700 dark:text-green-400 underline disabled:no-underline disabled:text-gray-300 dark:disabled:text-gray-600"
          >
            Select none
          </button>
        </div>
      </div>

      <div className="max-h-40 overflow-y-auto border border-gray-100 dark:border-gray-800 rounded-lg divide-y divide-gray-100 dark:divide-gray-800 mb-3">
        {listings.map((l) => (
          <label
            key={l.id}
            className="flex items-center gap-2 px-2.5 py-1.5 text-xs cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
          >
            <input
              type="checkbox"
              checked={selected.has(l.id)}
              onChange={() => toggle(l.id)}
              className="shrink-0"
            />
            <span className="flex-1 min-w-0 truncate text-gray-700 dark:text-gray-300">{l.strainName}</span>
            <span className="shrink-0 text-gray-400">
              ${l.pricePerUnit}/{l.unit} · {l.quantity} {l.unit}
            </span>
          </label>
        ))}
      </div>

      <div className="flex items-center justify-between text-xs mb-3 bg-gray-50 dark:bg-gray-800/60 rounded-lg px-3 py-2">
        <span className="text-gray-500 dark:text-gray-400">
          {noneSelected ? "No products selected" : `Selected value: ${money(currentTotal)}`}
        </span>
        {!noneSelected && (
          <span className={validValue ? "text-green-700 dark:text-green-400 font-medium" : "text-gray-400"}>
            → {money(previewTotal)}
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={save}
        disabled={saving || !validValue}
        className="bg-green-700 text-white rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50"
      >
        {saving
          ? "Applying…"
          : `Apply to ${selectedListings.length === listings.length ? "menu" : `${selectedListings.length} product${selectedListings.length === 1 ? "" : "s"}`}`}
      </button>

      {result && (
        <p className={`mt-2 text-xs ${result.ok ? "text-green-700 dark:text-green-400" : "text-red-600"}`}>
          {result.ok ? `Updated ${result.updatedCount} product${result.updatedCount === 1 ? "" : "s"}.` : result.error}
        </p>
      )}
    </div>
  );
}
