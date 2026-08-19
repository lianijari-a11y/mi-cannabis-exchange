"use client";

import { useState, useTransition } from "react";
import { Search } from "lucide-react";

type LookupResult =
  | { ok: true; phone: string | null; email: string | null; source: string | null }
  | { ok: false; error: string };

// Per-lead, on-demand AI web search for a phone/email a state-registry-
// derived MI Processor/Dispensary lead was never going to have (CLAUDE.md
// §38) — deliberately a review-then-accept step, not an auto-fill, since a
// wrong number handed to a rep with no chance to catch it is worse than no
// number at all.
export function ContactLookupButton({
  leadId,
  lookupAction,
  applyAction,
}: {
  leadId: string;
  lookupAction: (id: string) => Promise<LookupResult>;
  applyAction: (id: string, phone: string | null, email: string | null) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [result, setResult] = useState<LookupResult | null>(null);
  const [applied, setApplied] = useState(false);
  const [pending, startTransition] = useTransition();

  function search() {
    setResult(null);
    setApplied(false);
    startTransition(async () => setResult(await lookupAction(leadId)));
  }

  function accept() {
    if (!result?.ok) return;
    startTransition(async () => {
      const r = await applyAction(leadId, result.phone, result.email);
      if (r.ok) setApplied(true);
    });
  }

  if (applied) {
    return <span className="text-[11px] text-green-700 dark:text-green-400">✓ Contact info saved</span>;
  }

  if (result?.ok) {
    return (
      <div className="text-[11px] bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900 rounded-lg px-2 py-1.5 space-y-1">
        <p className="text-gray-700 dark:text-gray-300">
          {result.phone ? `📞 ${result.phone}` : "No phone found"}
          {result.email ? ` · ✉ ${result.email}` : ""}
        </p>
        {result.source && <p className="text-gray-400 truncate">Source: {result.source}</p>}
        {!result.phone && !result.email ? (
          <button type="button" onClick={search} className="text-blue-700 dark:text-blue-400 underline">
            Nothing found — try again
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={accept}
              disabled={pending}
              className="bg-green-700 text-white rounded px-2 py-0.5 disabled:opacity-50"
            >
              {pending ? "Saving…" : "Use this"}
            </button>
            <button type="button" onClick={() => setResult(null)} className="text-gray-400 underline">
              Discard
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={search}
        disabled={pending}
        className="inline-flex items-center gap-1 text-[11px] text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900 rounded-full px-2 py-0.5 disabled:opacity-50"
      >
        <Search className="w-3 h-3" /> {pending ? "Searching…" : "Find contact info"}
      </button>
      {result && !result.ok && <span className="text-[11px] text-red-600">{result.error}</span>}
    </span>
  );
}
