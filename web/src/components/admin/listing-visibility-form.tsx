"use client";

import { useState } from "react";

export function ListingVisibilityForm({
  listingId,
  currentVisibility,
  currentExclusiveIds,
  retailers,
  action,
}: {
  listingId: string;
  currentVisibility: string;
  currentExclusiveIds: string[];
  retailers: { id: string; businessName: string | null; fullName: string; anonHandle: string }[];
  action: (formData: FormData) => void;
}) {
  const [open, setOpen] = useState(false);
  const [visibility, setVisibility] = useState(currentVisibility);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs text-green-700 dark:text-green-400 underline">
        Manage distribution
      </button>
    );
  }

  return (
    <form action={action} className="mt-2 space-y-2 border-t border-gray-100 dark:border-gray-800 pt-2">
      <input type="hidden" name="listingId" value={listingId} />
      <div className="flex gap-3 text-xs">
        <label className="flex items-center gap-1">
          <input
            type="radio"
            name="visibility"
            value="all"
            checked={visibility === "all"}
            onChange={() => setVisibility("all")}
          />
          All retailers
        </label>
        <label className="flex items-center gap-1">
          <input
            type="radio"
            name="visibility"
            value="exclusive"
            checked={visibility === "exclusive"}
            onChange={() => setVisibility("exclusive")}
          />
          Exclusive to selected
        </label>
      </div>

      {visibility === "exclusive" && (
        <div className="max-h-32 overflow-y-auto border border-gray-200 dark:border-gray-800 rounded-lg p-2 space-y-1">
          {retailers.length === 0 && <p className="text-[11px] text-gray-400">No retailers on the platform yet.</p>}
          {retailers.map((r) => (
            <label key={r.id} className="flex items-center gap-2 text-[11px] text-gray-600 dark:text-gray-300">
              <input
                type="checkbox"
                name="retailerIds"
                value={r.id}
                defaultChecked={currentExclusiveIds.includes(r.id)}
              />
              {r.businessName ?? r.fullName} <span className="text-gray-400">({r.anonHandle})</span>
            </label>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <button type="submit" className="bg-green-700 text-white rounded-lg px-3 py-1.5 text-xs font-medium">
          Save
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-gray-500 dark:text-gray-400">
          Cancel
        </button>
      </div>
    </form>
  );
}
