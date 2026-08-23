"use client";

import { useState } from "react";

const inputClass =
  "border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1.5 text-xs bg-transparent";

type Suggestion = { id: string; suggestedPrice: number; message: string | null; resolvedAt: Date | string | null };

// A Broker's mediation suggestion on a thread AI escalated
// (needsBrokerMediation) — never a direct negotiation write, just a
// suggestion both parties see as a banner with a "Counter at $X" button on
// their own thread page. See lib/broker-mediation.ts.
export function BrokerSuggestionForm({
  threadId,
  suggestions,
  suggestAction,
}: {
  threadId: string;
  suggestions: Suggestion[];
  suggestAction: (formData: FormData) => void;
}) {
  const [open, setOpen] = useState(suggestions.length === 0);
  const active = suggestions.filter((s) => !s.resolvedAt);

  return (
    <div className="text-xs text-gray-600 dark:text-gray-400 space-y-2">
      {active.length > 0 && (
        <ul className="space-y-1">
          {active.map((s) => (
            <li key={s.id}>
              You suggested ${s.suggestedPrice}/unit{s.message ? ` — "${s.message}"` : ""}
            </li>
          ))}
        </ul>
      )}
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs border border-teal-600 text-teal-700 dark:text-teal-400 rounded-lg px-3 py-1.5 font-medium"
        >
          {active.length > 0 ? "Suggest a different price" : "Suggest a price"}
        </button>
      ) : (
        <form action={suggestAction} className="space-y-2">
          <input type="hidden" name="threadId" value={threadId} />
          <div className="flex items-center gap-2">
            <input
              name="suggestedPrice"
              type="number"
              step="0.01"
              min="0"
              placeholder="Suggested price"
              required
              className={`${inputClass} w-32`}
            />
          </div>
          <input name="message" placeholder="Message (optional)" className={`${inputClass} w-full`} />
          <div className="flex gap-2">
            <button type="submit" className="bg-teal-700 text-white rounded-lg px-3 py-1.5 text-xs font-medium">
              Send suggestion
            </button>
            <button type="button" onClick={() => setOpen(false)} className="text-xs text-gray-500 dark:text-gray-400">
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
