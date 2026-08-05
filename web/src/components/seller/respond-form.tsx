"use client";

import { useState } from "react";
import { TERMS, TERMS_LABELS } from "@/lib/constants";

const inputClass =
  "border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1 text-xs bg-transparent";

export function RespondForm({
  action,
  threadId,
  listingId,
}: {
  action: (formData: FormData) => void;
  threadId: string;
  listingId: string;
}) {
  const [mode, setMode] = useState<"idle" | "counter">("idle");

  return (
    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
      {mode === "idle" ? (
        <div className="flex gap-2">
          <form action={action}>
            <input type="hidden" name="threadId" value={threadId} />
            <input type="hidden" name="listingId" value={listingId} />
            <input type="hidden" name="action" value="accept" />
            <button
              type="submit"
              className="bg-green-700 text-white rounded-lg px-3 py-1.5 text-xs font-medium"
            >
              Accept
            </button>
          </form>
          <button
            type="button"
            onClick={() => setMode("counter")}
            className="border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300"
          >
            Counter
          </button>
          <form action={action}>
            <input type="hidden" name="threadId" value={threadId} />
            <input type="hidden" name="listingId" value={listingId} />
            <input type="hidden" name="action" value="reject" />
            <button
              type="submit"
              className="border border-red-300 dark:border-red-800 text-red-600 rounded-lg px-3 py-1.5 text-xs font-medium"
            >
              Reject
            </button>
          </form>
        </div>
      ) : (
        <form action={action} className="space-y-2">
          <input type="hidden" name="threadId" value={threadId} />
          <input type="hidden" name="listingId" value={listingId} />
          <input type="hidden" name="action" value="counter" />
          <div className="flex gap-2">
            <input
              name="price"
              type="number"
              step="0.01"
              min="0"
              placeholder="Price per unit"
              className={inputClass}
            />
            <select name="terms" className={inputClass} defaultValue="">
              <option value="">Terms unchanged</option>
              {TERMS.map((t) => (
                <option key={t} value={t}>
                  {TERMS_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <input
            name="message"
            placeholder="Message (optional)"
            className={`${inputClass} w-full`}
          />
          <div className="flex gap-2">
            <button
              type="submit"
              className="bg-green-700 text-white rounded-lg px-3 py-1.5 text-xs font-medium"
            >
              Send counter
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
      )}
    </div>
  );
}
