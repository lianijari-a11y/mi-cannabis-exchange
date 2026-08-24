"use client";

import { useState } from "react";
import type { LeadPhoneNumberRecord } from "./leads-manager";

// Up to 5 named phone numbers per lead — a business often has several
// real contacts (the original grower, a sales rep, a second location).
// sortOrder 0 is "main," sortOrder 1 is "2nd choice"; clicking those
// buttons reorders rather than toggling a separate flag per slot. A
// blocked number (an inbound "wrong number" reply, see
// lib/voipms-inbound.ts) shows a clear reason and can't be re-added under
// the same value without a rep consciously overriding it.
export function LeadPhoneNumbersEditor({
  leadId,
  numbers,
  actions,
}: {
  leadId: string;
  numbers: LeadPhoneNumberRecord[];
  actions: {
    addPhoneNumberAction: (leadId: string, phone: string, name: string) => Promise<void>;
    updatePhoneNumberAction: (id: string, phone: string, name: string) => Promise<void>;
    removePhoneNumberAction: (id: string) => Promise<void>;
    setPhoneNumberPositionAction: (leadId: string, phoneNumberId: string, position: 0 | 1) => Promise<void>;
  };
}) {
  const [busy, setBusy] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  }

  const sorted = [...numbers].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="mt-1.5 space-y-1">
      {sorted.map((n, i) => (
        <div
          key={n.id}
          className={`flex items-center gap-2 text-[11px] rounded-lg border px-2 py-1 ${
            n.blocked
              ? "border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/10"
              : "border-gray-200 dark:border-gray-800"
          }`}
        >
          <span className="shrink-0 text-[10px] uppercase tracking-wide text-gray-400 w-16">
            {i === 0 ? "Main" : i === 1 ? "2nd choice" : `#${i + 1}`}
          </span>
          {editingId === n.id ? (
            <form
              action={async (fd) => {
                await run(() =>
                  actions.updatePhoneNumberAction(n.id, String(fd.get("phone") ?? ""), String(fd.get("name") ?? ""))
                );
                setEditingId(null);
              }}
              className="flex flex-1 gap-1"
            >
              <input
                name="phone"
                defaultValue={n.phone}
                autoFocus
                className="w-28 border border-gray-300 dark:border-gray-700 rounded px-1.5 py-0.5 bg-transparent"
              />
              <input
                name="name"
                defaultValue={n.name ?? ""}
                placeholder="Name (optional)"
                className="flex-1 border border-gray-300 dark:border-gray-700 rounded px-1.5 py-0.5 bg-transparent"
              />
              <button type="submit" disabled={busy} className="text-green-700 dark:text-green-400 underline">
                Save
              </button>
              <button type="button" onClick={() => setEditingId(null)} className="text-gray-400">
                Cancel
              </button>
            </form>
          ) : (
            <>
              <span className={`flex-1 ${n.blocked ? "line-through text-gray-400" : "text-gray-700 dark:text-gray-300"}`}>
                {n.phone}
                {n.name ? ` — ${n.name}` : ""}
              </span>
              {n.blocked && <span className="text-red-600 dark:text-red-400 shrink-0">{n.blockedReason}</span>}
              {!n.blocked && i !== 0 && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(() => actions.setPhoneNumberPositionAction(leadId, n.id, 0))}
                  className="text-gray-500 dark:text-gray-400 underline shrink-0"
                >
                  Set main
                </button>
              )}
              {!n.blocked && i !== 1 && i !== 0 && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(() => actions.setPhoneNumberPositionAction(leadId, n.id, 1))}
                  className="text-gray-500 dark:text-gray-400 underline shrink-0"
                >
                  Set 2nd
                </button>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => setEditingId(n.id)}
                className="text-gray-500 dark:text-gray-400 underline shrink-0"
              >
                Edit
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => run(() => actions.removePhoneNumberAction(n.id))}
                className="text-red-500 underline shrink-0"
              >
                Remove
              </button>
            </>
          )}
        </div>
      ))}

      {showAdd ? (
        <form
          action={async (fd) => {
            await run(() => actions.addPhoneNumberAction(leadId, String(fd.get("phone") ?? ""), String(fd.get("name") ?? "")));
            setShowAdd(false);
          }}
          className="flex gap-1 text-[11px]"
        >
          <input
            name="phone"
            autoFocus
            placeholder="Phone"
            className="w-28 border border-gray-300 dark:border-gray-700 rounded px-1.5 py-0.5 bg-transparent"
          />
          <input
            name="name"
            placeholder="Name (optional)"
            className="flex-1 border border-gray-300 dark:border-gray-700 rounded px-1.5 py-0.5 bg-transparent"
          />
          <button type="submit" disabled={busy} className="text-green-700 dark:text-green-400 underline">
            Add
          </button>
          <button type="button" onClick={() => setShowAdd(false)} className="text-gray-400">
            Cancel
          </button>
        </form>
      ) : (
        numbers.length < 5 && (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="text-[11px] text-green-700 dark:text-green-400 underline"
          >
            + Add number ({numbers.length}/5)
          </button>
        )
      )}
    </div>
  );
}
