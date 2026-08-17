"use client";

import { useState, useTransition } from "react";
import { markOrderReadyAction, cancelOrderAction, fulfillOrderAction } from "@/app/retailer/pos/actions";

type Order = {
  id: string;
  customerName: string;
  customerPhone: string;
  requestedPickupNote: string | null;
  status: string;
  createdAt: Date;
  lineItems: { quantity: number; unitPriceSnapshot: number; lineTotal: number; inventoryLot: { productName: string; unit: string } }[];
};

const money = (n: number) => `$${n.toFixed(2)}`;

const STATUS_LABELS: Record<string, string> = {
  placed: "Placed",
  ready: "Ready for pickup",
};

function OrderCard({ order }: { order: Order }) {
  const [fulfilling, setFulfilling] = useState(false);
  const [tenderType, setTenderType] = useState<"cash" | "card" | "other">("cash");
  const [taxRatePercent, setTaxRatePercent] = useState(16);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const total = order.lineItems.reduce((sum, li) => sum + li.lineTotal, 0);

  function markReady() {
    startTransition(async () => {
      try {
        await markOrderReadyAction(order.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't update the order.");
      }
    });
  }

  function cancel() {
    startTransition(async () => {
      try {
        await cancelOrderAction(order.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't cancel the order.");
      }
    });
  }

  function fulfill() {
    setError(null);
    startTransition(async () => {
      try {
        await fulfillOrderAction(order.id, tenderType, taxRatePercent);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't complete this order.");
      }
    });
  }

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-xs space-y-2">
      <div className="flex items-center justify-between">
        <p className="font-medium text-gray-900 dark:text-gray-100">
          {order.customerName}{" "}
          <span className="text-gray-400 font-normal">
            {order.customerPhone} · {new Date(order.createdAt).toLocaleString()}
          </span>
        </p>
        <span
          className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full ${
            order.status === "ready"
              ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
              : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
          }`}
        >
          {STATUS_LABELS[order.status] ?? order.status}
        </span>
      </div>
      {order.requestedPickupNote && <p className="text-gray-500 dark:text-gray-400">Note: {order.requestedPickupNote}</p>}
      <div className="space-y-1">
        {order.lineItems.map((li, i) => (
          <div key={i} className="flex justify-between text-gray-700 dark:text-gray-300">
            <span>
              {li.inventoryLot.productName} × {li.quantity} {li.inventoryLot.unit}
            </span>
            <span>{money(li.lineTotal)}</span>
          </div>
        ))}
      </div>
      <div className="flex justify-between font-semibold text-gray-900 dark:text-gray-100">
        <span>Total</span>
        <span>{money(total)}</span>
      </div>

      {error && <p className="text-red-600">{error}</p>}

      {!fulfilling ? (
        <div className="flex gap-2 pt-1">
          {order.status === "placed" && (
            <button onClick={markReady} disabled={pending} className="text-green-700 dark:text-green-400 underline disabled:opacity-50">
              Mark ready
            </button>
          )}
          <button onClick={() => setFulfilling(true)} disabled={pending} className="text-green-700 dark:text-green-400 underline disabled:opacity-50">
            Fulfill (customer here)
          </button>
          <button onClick={cancel} disabled={pending} className="text-red-500 underline disabled:opacity-50">
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 pt-1 flex-wrap">
          <select
            value={tenderType}
            onChange={(e) => setTenderType(e.target.value as "cash" | "card" | "other")}
            className="border border-gray-300 dark:border-gray-700 rounded px-2 py-1 bg-transparent"
          >
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="other">Other</option>
          </select>
          <input
            type="number"
            min="0"
            step="0.1"
            value={taxRatePercent}
            onChange={(e) => setTaxRatePercent(Number(e.target.value))}
            className="w-16 border border-gray-300 dark:border-gray-700 rounded px-1 py-1 bg-transparent text-right"
          />
          <span className="text-gray-400">% tax</span>
          <button onClick={fulfill} disabled={pending} className="bg-green-700 text-white rounded-lg px-3 py-1.5 font-medium disabled:opacity-50">
            {pending ? "Completing…" : "Complete pickup"}
          </button>
          <button onClick={() => setFulfilling(false)} className="text-gray-400 underline">
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

export function OrdersPanel({ orders }: { orders: Order[] }) {
  if (orders.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md">No pending online orders.</p>;
  }
  return (
    <div className="space-y-2 max-w-2xl">
      {orders.map((order) => (
        <OrderCard key={order.id} order={order} />
      ))}
    </div>
  );
}
