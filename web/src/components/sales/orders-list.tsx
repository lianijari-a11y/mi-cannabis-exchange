"use client";

import { useMemo, useState } from "react";
import { CancelOrderButton } from "@/components/sales/cancel-order-button";
import { TERMS_LABELS, type Terms } from "@/lib/constants";

type Line = {
  threadId: string;
  status: string;
  strainName: string;
  unit: string;
  sellerLabel: string;
  latestRound: { action: string; price: number | null; quantity: number | null } | null;
};
type Order = {
  id: string;
  createdAt: Date | string;
  requestedTerms: string;
  retailerHandle: string;
  lines: Line[];
};

const STATUS_STYLE: Record<string, string> = {
  open: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  accepted: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
  rejected: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
};

function matches(order: Order, needle: string): boolean {
  if (!needle) return true;
  const haystack = [order.retailerHandle, ...order.lines.flatMap((l) => [l.strainName, l.sellerLabel])]
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

// Shared by /sales/orders and /admin/orders (CLAUDE.md §42) — one card per
// cart order, its lines each showing their own independent negotiation
// status (a cart order is several ordinary offer threads, not one status),
// with a cancel action that pulls back whatever's still open.
//
// Search is a plain client-side substring filter on the already-fetched
// list (same posture as NegotiationsDashboard's own search and the
// retailer feed's, CLAUDE.md §18) — matching the retailer's handle, a
// product's strain name, or a seller's label on any line.
export function OrdersList({
  orders,
  cancelAction,
}: {
  orders: Order[];
  cancelAction: (cartOrderId: string) => Promise<{ ok: true; canceledCount: number } | { ok: false; error: string }>;
}) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const filtered = useMemo(() => orders.filter((o) => matches(o, needle)), [orders, needle]);

  if (orders.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">No orders yet.</p>;
  }

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search retailer, strain, or seller…"
        className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm mb-4 bg-transparent"
      />

      {filtered.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">No orders match your search.</p>}

      <div className="space-y-3">
        {filtered.map((order) => {
          const openCount = order.lines.filter((l) => l.status === "open").length;
          return (
            <div
              key={order.id}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4"
            >
              <div className="flex items-start justify-between gap-2 flex-wrap mb-2">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {order.retailerHandle} · {order.lines.length} product{order.lines.length === 1 ? "" : "s"}
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date(order.createdAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}{" "}
                    · Requested {TERMS_LABELS[order.requestedTerms as Terms] ?? order.requestedTerms}
                  </p>
                </div>
                <CancelOrderButton cartOrderId={order.id} openCount={openCount} action={cancelAction} />
              </div>
              <div className="space-y-1.5">
                {order.lines.map((line) => (
                  <div key={line.threadId} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-gray-600 dark:text-gray-300">
                      {line.strainName} <span className="text-gray-400">— {line.sellerLabel}</span>
                      {line.latestRound?.quantity != null ? ` · ${line.latestRound.quantity} ${line.unit}` : ""}
                      {line.latestRound?.price != null ? ` · $${line.latestRound.price}/${line.unit}` : ""}
                    </span>
                    <span
                      className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0 ${
                        STATUS_STYLE[line.status] ?? STATUS_STYLE.rejected
                      }`}
                    >
                      {line.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
