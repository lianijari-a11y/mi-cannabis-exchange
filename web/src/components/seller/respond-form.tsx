"use client";

import { useState, useEffect } from "react";
import { TERMS, TERMS_LABELS, EXPIRATION_OPTIONS } from "@/lib/constants";

const inputClass =
  "border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1 text-xs bg-transparent";

export function RespondForm({
  action,
  threadId,
  listingId,
  initialPrice,
  hidden,
}: {
  action: (formData: FormData) => void;
  threadId: string;
  listingId: string;
  // Pre-fills and opens straight into counter mode with this price — used
  // by a Broker's mediation suggestion's "Counter at $X" button.
  initialPrice?: number;
  // While this party has an active AI-negotiation mandate on this thread,
  // their own manual controls are hidden — without this, a party could
  // manually counter at the same moment their own AI is mid-step,
  // producing a confusing double-actor trail. AI status/opt-out lives in
  // ai-mandate-panel.tsx instead.
  hidden?: boolean;
}) {
  const [mode, setMode] = useState<"idle" | "counter">(initialPrice != null ? "counter" : "idle");
  // useState's initial value only applies at mount — this component is
  // already mounted (and idle) by the time a Broker suggestion's "Counter
  // at $X" click changes `initialPrice` from undefined to a real number,
  // so switching into counter mode needs its own effect, not just the
  // initializer above (which only covers the case of mounting with a
  // suggestion already picked).
  useEffect(() => {
    if (initialPrice != null) setMode("counter");
  }, [initialPrice]);
  // Only the retailer opening a brand-new thread (threadId === "") gets to
  // choose an expiration — it's a one-time thread-level setting, not
  // renegotiated on every counter. See CLAUDE.md §18.
  const isNewThread = threadId === "";
  const [expiresInHours, setExpiresInHours] = useState("");

  if (hidden) return null;

  return (
    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
      {isNewThread && (
        <div className="mb-2">
          <label className="text-[10px] text-gray-400 dark:text-gray-500 block mb-0.5">
            This negotiation expires
          </label>
          <select
            value={expiresInHours}
            onChange={(e) => setExpiresInHours(e.target.value)}
            className={inputClass}
          >
            <option value="">No expiration</option>
            {EXPIRATION_OPTIONS.filter((o) => o.hours !== null).map((o) => (
              <option key={o.label} value={o.hours ?? ""}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      )}
      {mode === "idle" ? (
        <div className="flex gap-2">
          <form action={action}>
            <input type="hidden" name="threadId" value={threadId} />
            <input type="hidden" name="listingId" value={listingId} />
            <input type="hidden" name="action" value="accept" />
            {isNewThread && <input type="hidden" name="threadExpiresInHours" value={expiresInHours} />}
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
          {isNewThread && <input type="hidden" name="threadExpiresInHours" value={expiresInHours} />}
          <div className="flex gap-2">
            <input
              // Same mount-only-initializer issue as `mode` above —
              // `defaultValue` is only read the first time this
              // uncontrolled input mounts, so a `key` tied to initialPrice
              // forces a fresh mount (and a fresh defaultValue) whenever a
              // different suggestion is picked.
              key={initialPrice ?? "no-suggestion"}
              name="price"
              type="number"
              step="0.01"
              min="0"
              placeholder="Price per unit"
              defaultValue={initialPrice}
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
          <details className="text-xs">
            <summary className="cursor-pointer text-gray-500 dark:text-gray-400">
              Rejection fee terms (optional)
            </summary>
            <p className="mt-1 mb-2 text-[11px] text-gray-400 dark:text-gray-500">
              If the buyer ends up rejecting the delivered product, this is the fee (as a % of the
              deal&apos;s value) and who pays it. Defaults to a 50/50 split if never set.
            </p>
            <div className="flex gap-2">
              <input
                name="rejectionFeeRate"
                type="number"
                step="0.1"
                min="0"
                max="100"
                placeholder="Fee %"
                className={inputClass}
              />
              <select name="rejectionFeePayer" className={inputClass} defaultValue="">
                <option value="">Payer unchanged</option>
                <option value="split">Split 50/50</option>
                <option value="grower">Grower pays</option>
                <option value="retailer">Retailer pays</option>
              </select>
            </div>
          </details>
          <details className="text-xs">
            <summary className="cursor-pointer text-gray-500 dark:text-gray-400">
              Transport preference (optional)
            </summary>
            <p className="mt-1 mb-2 text-[11px] text-gray-400 dark:text-gray-500">
              Who you expect to cover the transporter&apos;s fee. This is a stated expectation, not
              the actual fee — the transporter sets the real amount later and isn&apos;t bound by
              this.
            </p>
            <select name="transportPayerPreference" className={inputClass} defaultValue="">
              <option value="">Preference unchanged</option>
              <option value="split">Split 50/50</option>
              <option value="grower">Grower pays</option>
              <option value="retailer">Retailer pays</option>
            </select>
          </details>
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
