"use client";

import { useMemo, useState } from "react";
import { DollarSign } from "lucide-react";

export type BulkAdjustLine = { id: string; label: string; price: number; quantity: number; unit: string };

const money = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD" });

// "The buyers should be able to bulk adjust price when doing a counter
// offer" — the mirror, on the retailer/AE/Admin side of a shared menu
// link, of the seller's own bulk price tool (components/seller/
// bulk-price-update.tsx). Deliberately client-only and lighter than that
// one: there's no server-side authorization to check here (nothing is
// written until Accept/Counter is actually clicked), so this just writes
// into CartBuilder's own `priceOverrides` state via `onApply` — the exact
// same per-line override mechanism the individual $ inputs already use,
// so a bulk adjustment and a manual per-line edit are indistinguishable
// to the rest of the cart once applied. Two modes only (percentage, set
// price) — matching exactly what was asked, no target-total/flat-dollar
// modes here since "the whole cart's total" isn't a number a buyer is
// usually negotiating toward the way a seller manages a menu's value.
export function CartBulkPriceAdjust({
  lines,
  onApply,
}: {
  lines: BulkAdjustLine[];
  onApply: (mode: "percent" | "setPrice", value: number, ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"percent" | "setPrice">("percent");
  const [value, setValue] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set(lines.map((l) => l.id)));
  const [applied, setApplied] = useState(false);

  const selectedLines = useMemo(() => lines.filter((l) => selected.has(l.id)), [lines, selected]);
  const allSelected = selectedLines.length === lines.length;
  const noneSelected = selectedLines.length === 0;

  const currentTotal = useMemo(
    () => selectedLines.reduce((sum, l) => sum + l.price * l.quantity, 0),
    [selectedLines]
  );

  const numValue = Number(value);
  const validValue = value.trim() !== "" && Number.isFinite(numValue) && (mode !== "setPrice" || numValue > 0) && !noneSelected;

  const previewTotal = useMemo(() => {
    if (!validValue) return currentTotal;
    return selectedLines.reduce((sum, l) => {
      const newPrice = mode === "percent" ? l.price * (1 + numValue / 100) : numValue;
      return sum + Math.max(0.01, newPrice) * l.quantity;
    }, 0);
  }, [selectedLines, mode, numValue, validValue, currentTotal]);

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function apply() {
    if (!validValue) return;
    onApply(mode, numValue, Array.from(selected));
    setValue("");
    setApplied(true);
    setTimeout(() => setApplied(false), 2000);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-[11px] text-green-700 dark:text-green-400 border border-green-200 dark:border-green-900 rounded-full px-2 py-0.5"
      >
        <DollarSign className="w-3 h-3" /> Bulk price adjust
      </button>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">Bulk price adjust</h4>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-gray-400 underline">
          Close
        </button>
      </div>

      <div className="flex gap-1.5 mb-3">
        {(
          [
            { key: "percent", label: "Percentage" },
            { key: "setPrice", label: "Set price" },
          ] as const
        ).map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => {
              setMode(m.key);
              setValue("");
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
        {mode === "setPrice" && <span className="text-sm text-gray-500 dark:text-gray-400">$</span>}
        <input
          type="number"
          step={mode === "percent" ? "1" : "0.01"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={mode === "percent" ? "e.g. 10 for +10%, -10 for -10%" : "e.g. 150 to set every selected product to $150/unit"}
          className="flex-1 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-transparent"
        />
        {mode === "percent" && <span className="text-sm text-gray-500 dark:text-gray-400">%</span>}
      </div>

      <div className="flex items-center justify-between mt-3 mb-1.5">
        <p className="text-[11px] text-gray-400">
          {selectedLines.length} of {lines.length} product{lines.length === 1 ? "" : "s"} selected
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSelected(new Set(lines.map((l) => l.id)))}
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
        {lines.map((l) => (
          <label
            key={l.id}
            className="flex items-center gap-2 px-2.5 py-1.5 text-xs cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
          >
            <input type="checkbox" checked={selected.has(l.id)} onChange={() => toggle(l.id)} className="shrink-0" />
            <span className="flex-1 min-w-0 truncate text-gray-700 dark:text-gray-300">{l.label}</span>
            <span className="shrink-0 text-gray-400">
              ${l.price}/{l.unit} · {l.quantity} {l.unit}
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
        onClick={apply}
        disabled={!validValue}
        className="bg-green-700 text-white rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50"
      >
        {`Apply to ${selectedLines.length === lines.length ? "cart" : `${selectedLines.length} product${selectedLines.length === 1 ? "" : "s"}`}`}
      </button>
      {applied && <p className="mt-2 text-xs text-green-700 dark:text-green-400">Applied — review the updated prices below.</p>}
    </div>
  );
}
