"use client";

import { useState } from "react";

export function ProductDecisionForm({
  dealId,
  listingId,
  acceptAction,
  rejectAction,
}: {
  dealId: string;
  listingId: string;
  acceptAction: (formData: FormData) => void;
  rejectAction: (formData: FormData) => void;
}) {
  const [mode, setMode] = useState<"idle" | "confirm-accept" | "reject">("idle");

  if (mode === "confirm-accept") {
    return (
      <div className="border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3">
        <p className="text-xs text-amber-800 dark:text-amber-400 font-medium mb-2">
          Once you confirm, this transaction is final. There's no undo or dispute process inside
          the app — any issue after this point has to be resolved directly with the other party.
        </p>
        <form action={acceptAction} className="flex gap-2">
          <input type="hidden" name="dealId" value={dealId} />
          <input type="hidden" name="listingId" value={listingId} />
          <button
            type="submit"
            className="bg-amber-700 text-white rounded-lg px-3 py-1.5 text-xs font-medium"
          >
            Confirm — accept product
          </button>
          <button
            type="button"
            onClick={() => setMode("idle")}
            className="text-xs text-gray-500 dark:text-gray-400"
          >
            Cancel
          </button>
        </form>
      </div>
    );
  }

  if (mode === "reject") {
    return (
      <form action={rejectAction} className="space-y-2">
        <input type="hidden" name="dealId" value={dealId} />
        <input type="hidden" name="listingId" value={listingId} />
        <input
          name="reason"
          required
          placeholder="What's wrong with the shipment? (required)"
          className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1.5 text-xs bg-transparent"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            className="border border-red-300 dark:border-red-800 text-red-600 rounded-lg px-3 py-1.5 text-xs font-medium"
          >
            Confirm rejection
          </button>
          <button
            type="button"
            onClick={() => setMode("idle")}
            className="text-xs text-gray-500 dark:text-gray-400"
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => setMode("confirm-accept")}
        className="bg-green-700 text-white rounded-lg px-3 py-1.5 text-xs font-medium"
      >
        Accept delivered product
      </button>
      <button
        type="button"
        onClick={() => setMode("reject")}
        className="border border-red-300 dark:border-red-800 text-red-600 rounded-lg px-3 py-1.5 text-xs font-medium"
      >
        Reject
      </button>
    </div>
  );
}
