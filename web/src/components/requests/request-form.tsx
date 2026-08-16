"use client";

import { useState } from "react";
import { CATEGORIES, CATEGORY_LABELS, TERMS, TERMS_LABELS } from "@/lib/constants";

const inputClass =
  "border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1.5 text-xs bg-transparent w-full";

export function RequestForm({ action }: { action: (formData: FormData) => void }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-green-700 text-white rounded-lg px-3 py-1.5 text-xs font-medium"
      >
        Post a request
      </button>
    );
  }

  return (
    <form action={action} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 space-y-2 max-w-md">
      <input name="productName" placeholder="What do you need? (e.g. Trim, any strain)" required className={inputClass} />
      <div className="grid grid-cols-2 gap-2">
        <select name="category" defaultValue="" className={inputClass}>
          <option value="">Any category</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        <select name="termsPreference" defaultValue="" className={inputClass}>
          <option value="">Any terms</option>
          {TERMS.map((t) => (
            <option key={t} value={t}>
              {TERMS_LABELS[t]}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <input name="quantity" type="number" step="0.01" min="0.01" placeholder="Quantity" required className={inputClass} />
        <select name="unit" defaultValue="lb" className={inputClass}>
          <option value="lb">lb</option>
          <option value="liter">liter</option>
          <option value="unit">unit</option>
        </select>
        <input name="targetPrice" type="number" step="0.01" min="0" placeholder="Target $/unit" className={inputClass} />
      </div>
      <textarea name="note" rows={2} placeholder="Any other details (optional)" className={inputClass} />
      <div className="flex gap-2">
        <button type="submit" className="bg-green-700 text-white rounded-lg px-3 py-1.5 text-xs font-medium">
          Post to suppliers
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-gray-500 dark:text-gray-400">
          Cancel
        </button>
      </div>
    </form>
  );
}
