"use client";

import { useState, useTransition } from "react";

type BroadcastResult = { ok: true; notifiedCount: number } | { ok: false; error: string };

// Next to "Share menus with a link" (the manual, hand-picked-menus
// builder) — one click that bundles every one of the actor's own current
// menus and pushes the link to every Retailer or every Processor via the
// in-app notification bell. See lib/menu-broadcast.ts for why Processors
// get this too even though they can't check out a cart yet.
export function BroadcastMenusButton({
  label,
  action,
}: {
  label: string;
  action: () => Promise<BroadcastResult>;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<BroadcastResult | null>(null);

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setResult(await action());
          })
        }
        className="border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50"
      >
        {pending ? "Sending…" : label}
      </button>
      {result && (
        <p className={`text-[11px] ${result.ok ? "text-green-700 dark:text-green-400" : "text-red-600"}`}>
          {result.ok
            ? `Sent to ${result.notifiedCount} account${result.notifiedCount === 1 ? "" : "s"}.`
            : result.error}
        </p>
      )}
    </div>
  );
}
