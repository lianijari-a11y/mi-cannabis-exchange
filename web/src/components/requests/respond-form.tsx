"use client";

import { useState } from "react";

const inputClass =
  "border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1.5 text-xs bg-transparent w-full";

export function RespondForm({
  requestId,
  unit,
  myListings,
  action,
}: {
  requestId: string;
  unit: string;
  myListings: { id: string; strainName: string }[];
  action: (formData: FormData) => void;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-green-700 dark:text-green-400 font-medium underline"
      >
        Respond
      </button>
    );
  }

  return (
    <form action={action} className="space-y-2 mt-2 border-t border-gray-100 dark:border-gray-800 pt-2">
      <input type="hidden" name="requestId" value={requestId} />
      {myListings.length > 0 && (
        <select name="listingId" defaultValue="" className={inputClass}>
          <option value="">No matching listing to link (just a message)</option>
          {myListings.map((l) => (
            <option key={l.id} value={l.id}>
              Link my listing: {l.strainName}
            </option>
          ))}
        </select>
      )}
      <div className="flex gap-2">
        <input name="price" type="number" step="0.01" min="0" placeholder={`$/${unit}`} className={inputClass} />
        <input name="quantity" type="number" step="0.01" min="0" placeholder="Quantity" className={inputClass} />
      </div>
      <textarea name="message" rows={2} placeholder="Message to the retailer" required className={inputClass} />
      <div className="flex gap-2">
        <button type="submit" className="bg-green-700 text-white rounded-lg px-3 py-1.5 text-xs font-medium">
          Send response
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-gray-500 dark:text-gray-400">
          Cancel
        </button>
      </div>
    </form>
  );
}
