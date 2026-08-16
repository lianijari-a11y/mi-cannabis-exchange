"use client";

import { useState } from "react";

const inputClass =
  "border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1.5 text-xs bg-transparent";

type Commission = {
  rate: number;
  payerType: string;
  splitGrowerPct: number | null;
  amount: number | null;
  growerOwes: number | null;
  retailerOwes: number | null;
  status: string;
};

export function CommissionForm({
  dealId,
  commission,
  setAction,
  markPaidAction,
}: {
  dealId: string;
  commission: Commission | null;
  setAction: (formData: FormData) => void;
  markPaidAction: (formData: FormData) => void;
}) {
  const [open, setOpen] = useState(false);
  const [payerType, setPayerType] = useState(commission?.payerType ?? "split");

  if (!open && !commission) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs border border-teal-600 text-teal-700 dark:text-teal-400 rounded-lg px-3 py-1.5 font-medium"
      >
        Set commission
      </button>
    );
  }

  if (!open && commission) {
    return (
      <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
        <p>
          Commission: {commission.rate}% · paid by{" "}
          {commission.payerType === "split"
            ? `split (grower ${commission.splitGrowerPct}% / retailer ${100 - (commission.splitGrowerPct ?? 50)}%)`
            : commission.payerType}
          {commission.amount != null ? ` · $${commission.amount} total` : " · amount pending delivery acceptance"}
        </p>
        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full ${
              commission.status === "paid"
                ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
            }`}
          >
            {commission.status}
          </span>
          <button type="button" onClick={() => setOpen(true)} className="text-teal-700 dark:text-teal-400 underline">
            Edit
          </button>
          {commission.status !== "paid" && commission.amount != null && (
            <form action={markPaidAction}>
              <input type="hidden" name="dealId" value={dealId} />
              <button type="submit" className="text-teal-700 dark:text-teal-400 underline">
                Mark paid
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <form action={setAction} className="space-y-2">
      <input type="hidden" name="dealId" value={dealId} />
      <div className="flex items-center gap-2">
        <input
          name="rate"
          type="number"
          min="0"
          max="100"
          step="0.5"
          defaultValue={commission?.rate ?? 5}
          className={`${inputClass} w-20`}
        />
        <span className="text-xs text-gray-400">% rate — your call, any value 0-100</span>
      </div>
      <select
        name="payerType"
        value={payerType}
        onChange={(e) => setPayerType(e.target.value)}
        className={inputClass}
      >
        <option value="grower">Grower pays</option>
        <option value="retailer">Retailer pays</option>
        <option value="split">Split between both</option>
      </select>
      {payerType === "split" && (
        <div className="flex items-center gap-2">
          <input
            name="splitGrowerPct"
            type="number"
            min="0"
            max="100"
            defaultValue={commission?.splitGrowerPct ?? 50}
            className={`${inputClass} w-20`}
          />
          <span className="text-xs text-gray-400">% of the commission paid by the grower</span>
        </div>
      )}
      <div className="flex gap-2">
        <button type="submit" className="bg-teal-700 text-white rounded-lg px-3 py-1.5 text-xs font-medium">
          Save commission terms
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-gray-500 dark:text-gray-400">
          Cancel
        </button>
      </div>
    </form>
  );
}
