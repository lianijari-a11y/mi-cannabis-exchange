"use client";

import { useState, useTransition } from "react";
import {
  lookupCustomerAction,
  saveCustomerAction,
  redeemLoyaltyPointsAction,
} from "@/app/retailer/pos/actions";

export type CustomerInfo = {
  id: string;
  name: string;
  phone: string;
  notes: string | null;
  loyaltyPointsBalance: number;
  habits: {
    saleCount: number;
    avgSpend: number;
    lastSaleAt: string;
    salesPerMonth: number;
    topCategories: { category: string; avgSpend: number }[];
  } | null;
  purchaseTotals: { flowerEquivalentOz: number; otherUnitsCount: number };
};

const money = (n: number) => `$${n.toFixed(2)}`;

// Register customer panel — lookup-or-create by phone, purchase habits,
// loyalty balance/redeem, and the purchase-limit bar. No password/login,
// just a recognition key a budtender types in — see CLAUDE.md's plan for
// why this reverses the app's original "receipt-only, never re-identify"
// posture (a deliberate, confirmed decision, not a quiet default).
export function CustomerPanel({
  selected,
  dailyPurchaseLimitOz,
  cartIsEmpty,
  onSelect,
  onClear,
  onDiscountFromRedeem,
}: {
  selected: CustomerInfo | null;
  dailyPurchaseLimitOz: number | null;
  cartIsEmpty: boolean;
  onSelect: (customer: CustomerInfo) => void;
  onClear: () => void;
  onDiscountFromRedeem: (discountAmount: number) => void;
}) {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [redeemPoints, setRedeemPoints] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function lookup() {
    setError(null);
    setNotFound(false);
    startTransition(async () => {
      const customer = await lookupCustomerAction(phone);
      if (customer) {
        onSelect(customer);
      } else {
        setNotFound(true);
      }
    });
  }

  function createCustomer() {
    setError(null);
    startTransition(async () => {
      try {
        const customer = await saveCustomerAction(name, phone, notes);
        onSelect(customer);
        setNotFound(false);
        setName("");
        setNotes("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save this customer.");
      }
    });
  }

  function redeem() {
    if (!selected) return;
    if (cartIsEmpty) {
      setError("Add an item to the cart before redeeming points.");
      return;
    }
    const points = Number(redeemPoints);
    setError(null);
    startTransition(async () => {
      try {
        const result = await redeemLoyaltyPointsAction(selected.id, points);
        onDiscountFromRedeem(result.discountAmount);
        setRedeemPoints("");
        // Re-lookup to refresh the displayed balance after redemption.
        const refreshed = await lookupCustomerAction(selected.phone);
        if (refreshed) onSelect(refreshed);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't redeem points.");
      }
    });
  }

  if (!selected) {
    return (
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 space-y-2">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Customer (optional)</p>
        <div className="flex gap-2">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone number"
            type="tel"
            className="flex-1 border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1.5 text-xs bg-transparent"
          />
          <button
            onClick={lookup}
            disabled={pending || !phone.trim()}
            className="border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50"
          >
            Look up
          </button>
        </div>

        {notFound && (
          <div className="space-y-2 pt-1 border-t border-gray-200 dark:border-gray-800">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              No customer on file for that number — add them:
            </p>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Customer name"
              className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1.5 text-xs bg-transparent"
            />
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes, optional (e.g. prefers flower)"
              className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1.5 text-xs bg-transparent"
            />
            <button
              onClick={createCustomer}
              disabled={pending || !name.trim()}
              className="bg-green-700 text-white rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50"
            >
              Add customer
            </button>
          </div>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  const limitPct = dailyPurchaseLimitOz
    ? Math.min(100, (selected.purchaseTotals.flowerEquivalentOz / dailyPurchaseLimitOz) * 100)
    : null;
  const overLimit = dailyPurchaseLimitOz != null && selected.purchaseTotals.flowerEquivalentOz > dailyPurchaseLimitOz;

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{selected.name}</p>
          <p className="text-xs text-gray-400">{selected.phone}</p>
        </div>
        <button onClick={onClear} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          Clear
        </button>
      </div>

      {selected.notes && (
        <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2">
          {selected.notes}
        </p>
      )}

      {selected.habits ? (
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <p className="text-gray-400">Avg spend</p>
            <p className="font-medium text-gray-900 dark:text-gray-100">{money(selected.habits.avgSpend)}</p>
          </div>
          <div>
            <p className="text-gray-400">Last sale</p>
            <p className="font-medium text-gray-900 dark:text-gray-100">
              {new Date(selected.habits.lastSaleAt).toLocaleDateString()}
            </p>
          </div>
          <div>
            <p className="text-gray-400">Sales/month</p>
            <p className="font-medium text-gray-900 dark:text-gray-100">{selected.habits.salesPerMonth}</p>
          </div>
        </div>
      ) : (
        <p className="text-xs text-gray-400">No purchase history yet.</p>
      )}

      {dailyPurchaseLimitOz != null && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500 dark:text-gray-400">Today&apos;s flower purchases</span>
            <span className={overLimit ? "text-red-600 font-medium" : "text-gray-500 dark:text-gray-400"}>
              {selected.purchaseTotals.flowerEquivalentOz.toFixed(2)} / {dailyPurchaseLimitOz} oz
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
            <div
              className={`h-full rounded-full ${overLimit ? "bg-red-600" : "bg-green-700"}`}
              style={{ width: `${limitPct ?? 0}%` }}
            />
          </div>
          {selected.purchaseTotals.otherUnitsCount > 0 && (
            <p className="text-[11px] text-gray-400">
              +{selected.purchaseTotals.otherUnitsCount} concentrate/vape/edible unit
              {selected.purchaseTotals.otherUnitsCount === 1 ? "" : "s"} today, not converted into the ounce
              figure above — no certified flower-equivalency ratio built in yet.
            </p>
          )}
          {overLimit && (
            <p className="text-[11px] text-red-600">
              This customer&apos;s tracked purchases today already exceed the configured limit.
            </p>
          )}
        </div>
      )}

      <div className="flex items-center justify-between pt-1 border-t border-gray-200 dark:border-gray-800">
        <div className="text-xs">
          <span className="text-gray-400">Loyalty balance</span>{" "}
          <span className="font-medium text-gray-900 dark:text-gray-100">{selected.loyaltyPointsBalance} pts</span>
        </div>
        <div className="flex items-center gap-1">
          <input
            value={redeemPoints}
            onChange={(e) => setRedeemPoints(e.target.value)}
            type="number"
            min="1"
            max={selected.loyaltyPointsBalance}
            placeholder="Points"
            className="w-16 border border-gray-300 dark:border-gray-700 rounded px-1.5 py-1 text-xs bg-transparent text-right"
          />
          <button
            onClick={redeem}
            disabled={pending || !redeemPoints || selected.loyaltyPointsBalance === 0 || cartIsEmpty}
            title={cartIsEmpty ? "Add an item to the cart first" : undefined}
            className="border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1 text-xs font-medium disabled:opacity-50"
          >
            Redeem
          </button>
        </div>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
