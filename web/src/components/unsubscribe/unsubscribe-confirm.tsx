"use client";

import { useState, useTransition } from "react";

// A real click-triggered POST, not a bare-GET mutation — some corporate
// email security scanners "click" every link in a delivered email
// (including unsubscribe links) as a malware check, which would silently
// unsubscribe someone who never asked to be if the GET itself did the
// write. The GET here only ever renders this confirm button; the actual
// state change happens on this button's own click.
export function UnsubscribeConfirm({
  leadId,
  token,
  confirmAction,
}: {
  leadId: string;
  token: string;
  confirmAction: (leadId: string, token: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [result, setResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  if (result?.ok) {
    return <p className="text-sm text-gray-700 dark:text-gray-300">You&rsquo;re unsubscribed — we won&rsquo;t email you again.</p>;
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={isPending}
        onClick={() => startTransition(async () => setResult(await confirmAction(leadId, token)))}
        className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {isPending ? "Unsubscribing…" : "Unsubscribe me"}
      </button>
      {result?.error && <p className="text-xs text-red-600">{result.error}</p>}
    </div>
  );
}
