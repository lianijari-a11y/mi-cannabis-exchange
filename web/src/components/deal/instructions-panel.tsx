"use client";

import { useState } from "react";

// Shared by the Grower/Processor side (pickup instructions) and the
// Retailer side (delivery instructions) — each only ever edits their own
// field. See lib/shipments.ts's setPickupInstructions/setDeliveryInstructions.
export function InstructionsPanel({
  label,
  value,
  shipmentId,
  listingId,
  action,
}: {
  label: string;
  value: string | null;
  shipmentId: string;
  listingId: string;
  action: (formData: FormData) => void;
}) {
  const [editing, setEditing] = useState(!value);

  if (!editing) {
    return (
      <div className="mt-2 border border-gray-200 dark:border-gray-800 rounded-lg p-3">
        <p className="text-xs font-medium text-gray-900 dark:text-gray-100 mb-1">{label}</p>
        <p className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap mb-2">{value}</p>
        <button type="button" onClick={() => setEditing(true)} className="text-xs text-green-700 dark:text-green-400 underline">
          Edit
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="mt-2 border border-gray-200 dark:border-gray-800 rounded-lg p-3">
      <input type="hidden" name="shipmentId" value={shipmentId} />
      <input type="hidden" name="listingId" value={listingId} />
      <label className="text-xs font-medium text-gray-900 dark:text-gray-100 block mb-1">{label}</label>
      <p className="text-[11px] text-gray-400 mb-1.5">
        Gate code, dock/entrance to use, hours, who to ask for — anything the transporter needs before they show up.
      </p>
      <textarea
        name="instructions"
        defaultValue={value ?? ""}
        rows={3}
        placeholder="e.g. Use the loading dock on the north side, ask for Dave, gate code 4471"
        className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1.5 text-xs bg-transparent mb-2"
      />
      <div className="flex gap-2">
        <button type="submit" className="bg-green-700 text-white rounded-lg px-3 py-1.5 text-xs font-medium">
          Save
        </button>
        {!!value && (
          <button type="button" onClick={() => setEditing(false)} className="text-xs text-gray-500 dark:text-gray-400">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
