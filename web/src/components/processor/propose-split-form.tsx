"use client";

import { useState } from "react";

const inputClass =
  "border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1.5 text-xs bg-transparent w-full";

export function ProposeSplitForm({
  action,
  listingId,
}: {
  action: (formData: FormData) => void;
  listingId: string;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full border border-teal-600 text-teal-700 dark:text-teal-400 rounded-lg px-3 py-1.5 text-xs font-medium"
      >
        Propose split contract
      </button>
    );
  }

  return (
    <form action={action} className="space-y-2 mt-2">
      <input type="hidden" name="listingId" value={listingId} />
      <input
        name="outputProduct"
        placeholder="Output product (e.g. Distillate)"
        required
        className={inputClass}
      />
      <div className="flex items-center gap-2">
        <input
          name="splitGrowerPct"
          type="number"
          min="1"
          max="99"
          defaultValue="60"
          required
          className={inputClass}
        />
        <span className="text-xs text-gray-400 whitespace-nowrap">% to grower</span>
      </div>
      <textarea
        name="note"
        rows={2}
        placeholder="Note to grower (optional)"
        className={inputClass}
      />
      <div className="flex gap-2">
        <button
          type="submit"
          className="bg-teal-700 text-white rounded-lg px-3 py-1.5 text-xs font-medium"
        >
          Send proposal
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-gray-500 dark:text-gray-400"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
