"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type CancelResult = { ok: true; canceledCount: number } | { ok: false; error: string };

// "A button for account rep to cancel an order" — pulls back every still-
// open line this actor has standing over in a cart order (lib/cart-order-
// management.ts's cancelCartOrder). Confirms first since this rejects real
// negotiations the retailer is waiting on.
export function CancelOrderButton({
  cartOrderId,
  openCount,
  action,
}: {
  cartOrderId: string;
  openCount: number;
  action: (cartOrderId: string) => Promise<CancelResult>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<CancelResult | null>(null);
  const [confirming, setConfirming] = useState(false);

  if (result?.ok) {
    return (
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Canceled {result.canceledCount} line{result.canceledCount === 1 ? "" : "s"}.
      </p>
    );
  }

  if (openCount === 0) return null;

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-xs text-red-600 border border-red-200 dark:border-red-900 rounded-full px-2.5 py-1"
      >
        Cancel order
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 dark:text-gray-400">
        Cancel all {openCount} open line{openCount === 1 ? "" : "s"}?
      </span>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const r = await action(cartOrderId);
            setResult(r);
            if (r.ok) router.refresh();
          })
        }
        className="text-xs bg-red-600 text-white rounded-full px-2.5 py-1 disabled:opacity-50"
      >
        {pending ? "Canceling…" : "Yes, cancel"}
      </button>
      <button type="button" onClick={() => setConfirming(false)} className="text-xs text-gray-400 underline">
        Never mind
      </button>
      {result?.ok === false && <span className="text-xs text-red-600">{result.error}</span>}
    </div>
  );
}
