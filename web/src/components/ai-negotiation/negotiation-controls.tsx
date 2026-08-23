"use client";

import { useState } from "react";
import { RespondForm } from "@/components/seller/respond-form";

type Suggestion = { id: string; suggestedPrice: number; message: string | null };

// Wraps the ordinary Accept/Counter/Reject form together with any open
// Broker mediation suggestions for this thread — a suggestion's "Use this
// price" pre-fills the counter form's price rather than submitting
// anything itself, so the party still makes their own real decision
// through the normal human path. See lib/broker-mediation.ts.
export function NegotiationControls({
  action,
  threadId,
  listingId,
  hidden,
  suggestions,
}: {
  action: (formData: FormData) => void;
  threadId: string;
  listingId: string;
  hidden?: boolean;
  suggestions: Suggestion[];
}) {
  const [pickedPrice, setPickedPrice] = useState<number | undefined>(undefined);

  return (
    <div>
      {suggestions.length > 0 && (
        <div className="mb-2 space-y-1">
          {suggestions.map((s) => (
            <div
              key={s.id}
              className="text-xs bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 flex items-center justify-between gap-2"
            >
              <span className="text-amber-800 dark:text-amber-300">
                Broker suggests ${s.suggestedPrice}/unit{s.message ? ` — "${s.message}"` : ""}
              </span>
              <button
                type="button"
                onClick={() => setPickedPrice(s.suggestedPrice)}
                className="shrink-0 text-amber-700 dark:text-amber-400 font-medium underline"
              >
                Counter at ${s.suggestedPrice}
              </button>
            </div>
          ))}
        </div>
      )}
      <RespondForm
        action={action}
        threadId={threadId}
        listingId={listingId}
        initialPrice={pickedPrice}
        hidden={hidden}
      />
    </div>
  );
}
