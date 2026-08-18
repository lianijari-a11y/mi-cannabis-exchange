"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { lookupSkuAction, checkoutAction } from "@/app/retailer/pos/actions";
import { thcMgForLine, holidayInfo } from "@/lib/pos-calculations";
import { CustomerPanel, type CustomerInfo } from "./customer-panel";

export type CartLine = {
  lotId: string;
  sku: string;
  productName: string;
  unit: string;
  unitPrice: number;
  quantityRemaining: number;
  quantity: number;
  thcPercent: number | null;
  thcMgPerUnit: number | null;
  discountAmount: number;
};

type Receipt = {
  id: string;
  saleNumber: number;
  subtotal: number;
  taxAmount: number;
  total: number;
  tenderType: string;
  orderType: string;
  customerName: string | null;
  createdAt: string;
  lineItems: {
    productName: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    discountAmount: number;
    lineTotal: number;
  }[];
};

const money = (n: number) => `$${n.toFixed(2)}`;
const STANDARD_DOSE_MG = 10;

const ORDER_TYPE_LABELS: Record<string, string> = {
  in_store: "In-store",
  pickup: "Pickup",
  curbside: "Curbside",
};

// The scan field is a plain auto-focused text input inside a form — a USB/
// Bluetooth barcode scanner types the code and an Enter keystroke into
// whatever's focused, identical to a keyboard, which submits this form.
// Manual typing works the same way as a fallback. See CLAUDE.md §23 on why
// this app doesn't use camera-based scanning.
export function RegisterPanel({ dailyPurchaseLimitOz }: { dailyPurchaseLimitOz: number | null }) {
  const router = useRouter();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [sku, setSku] = useState("");
  const [tenderType, setTenderType] = useState<"cash" | "card" | "other">("cash");
  const [orderType, setOrderType] = useState<"in_store" | "pickup" | "curbside">("in_store");
  const [customerName, setCustomerName] = useState("");
  const [customer, setCustomer] = useState<CustomerInfo | null>(null);
  const [taxRatePercent, setTaxRatePercent] = useState(16);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleScan(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const code = sku.trim();
    setSku("");
    if (!code) return;

    const lot = await lookupSkuAction(code);
    if (!lot) {
      setError(`No inventory item found for "${code}".`);
      return;
    }
    setCart((prev) => {
      const existing = prev.find((l) => l.lotId === lot.id);
      if (existing) {
        return prev.map((l) => (l.lotId === lot.id ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [
        ...prev,
        {
          lotId: lot.id,
          sku: lot.sku,
          productName: lot.productName,
          unit: lot.unit,
          unitPrice: lot.retailPricePerUnit,
          quantityRemaining: lot.quantityRemaining,
          quantity: 1,
          thcPercent: lot.thcPercent,
          thcMgPerUnit: lot.thcMgPerUnit,
          discountAmount: 0,
        },
      ];
    });
    inputRef.current?.focus();
  }

  function updateQuantity(lotId: string, quantity: number) {
    setCart((prev) => prev.map((l) => (l.lotId === lotId ? { ...l, quantity } : l)));
  }

  function updateDiscount(lotId: string, discountAmount: number) {
    setCart((prev) => prev.map((l) => (l.lotId === lotId ? { ...l, discountAmount: Math.max(0, discountAmount) } : l)));
  }

  function removeLine(lotId: string) {
    setCart((prev) => prev.filter((l) => l.lotId !== lotId));
  }

  // A loyalty redemption is a cart-level idea (not tied to one product),
  // but the schema only carries a discount per line — deliberately simpler
  // for now, see CLAUDE.md's plan. Applied here to whichever line currently
  // has the most room to absorb it, so redeeming points doesn't get
  // silently clamped away on a small cart line.
  function applyRedeemedDiscount(discountAmount: number) {
    setCart((prev) => {
      if (prev.length === 0) return prev; // guarded upstream in CustomerPanel; defensive no-op here
      let target = prev[0];
      let mostRoom = -Infinity;
      for (const l of prev) {
        const room = l.quantity * l.unitPrice - l.discountAmount;
        if (room > mostRoom) {
          mostRoom = room;
          target = l;
        }
      }
      return prev.map((l) =>
        l.lotId === target.lotId ? { ...l, discountAmount: l.discountAmount + discountAmount } : l
      );
    });
  }

  const subtotal = cart.reduce((sum, l) => sum + Math.max(0, l.quantity * l.unitPrice - l.discountAmount), 0);
  const taxAmount = subtotal * (taxRatePercent / 100);
  const total = subtotal + taxAmount;
  const totalThcMg = cart.reduce((sum, l) => sum + (thcMgForLine(l) ?? 0), 0);
  const anyThcComputed = cart.some((l) => thcMgForLine(l) !== null);

  function completeSale() {
    setError(null);
    startTransition(async () => {
      try {
        const sale = await checkoutAction(
          cart.map((l) => ({ lotId: l.lotId, quantity: l.quantity, discountAmount: l.discountAmount })),
          tenderType,
          taxRatePercent,
          orderType,
          customerName,
          customer?.id
        );
        setReceipt(sale);
        setCart([]);
        setCustomerName("");
        setCustomer(null);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't complete the sale.");
      }
    });
  }

  if (receipt) {
    const holiday = holidayInfo(new Date(receipt.createdAt));
    return (
      <div className="relative max-w-sm mx-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 overflow-hidden print:border-0">
        <div
          aria-hidden
          className="pointer-events-none select-none absolute inset-0 flex items-center justify-center text-[140px] leading-none opacity-[0.07] -rotate-12"
        >
          {holiday.icon}
        </div>
        <div className="relative">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
            Sale #{receipt.saleNumber} complete
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            {new Date(receipt.createdAt).toLocaleString()} · {receipt.tenderType} ·{" "}
            {ORDER_TYPE_LABELS[receipt.orderType] ?? receipt.orderType}
          </p>
          {receipt.customerName && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">For {receipt.customerName}</p>
          )}
          <p className="text-xs text-green-700 dark:text-green-400 mb-3">
            {holiday.icon} {holiday.greeting}
          </p>
          <div className="text-xs space-y-1 mb-3">
            {receipt.lineItems.map((li, i) => (
              <div key={i} className="flex justify-between text-gray-700 dark:text-gray-300">
                <span>
                  {li.productName} × {li.quantity} {li.unit}
                </span>
                <span>
                  {li.discountAmount > 0 && (
                    <span className="text-gray-400 line-through mr-1">
                      {money(li.quantity * li.unitPrice)}
                    </span>
                  )}
                  {money(li.lineTotal)}
                </span>
              </div>
            ))}
          </div>
          <div className="text-xs border-t border-gray-200 dark:border-gray-800 pt-2 space-y-1">
            <div className="flex justify-between text-gray-500 dark:text-gray-400">
              <span>Subtotal</span>
              <span>{money(receipt.subtotal)}</span>
            </div>
            <div className="flex justify-between text-gray-500 dark:text-gray-400">
              <span>Tax</span>
              <span>{money(receipt.taxAmount)}</span>
            </div>
            <div className="flex justify-between font-semibold text-gray-900 dark:text-gray-100">
              <span>Total</span>
              <span>{money(receipt.total)}</span>
            </div>
          </div>
          <div className="flex gap-2 mt-4 print:hidden">
            <button
              onClick={() => window.print()}
              className="flex-1 border border-gray-300 dark:border-gray-700 rounded-lg py-1.5 text-xs font-medium"
            >
              Print receipt
            </button>
            <button
              onClick={() => setReceipt(null)}
              className="flex-1 bg-green-700 text-white rounded-lg py-1.5 text-xs font-medium"
            >
              New sale
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg space-y-3">
      <form onSubmit={handleScan} className="flex gap-2">
        <input
          ref={inputRef}
          autoFocus
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          placeholder="Scan or type a barcode/SKU…"
          className="flex-1 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-transparent"
        />
        <button type="submit" className="border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-xs font-medium">
          Add
        </button>
      </form>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <CustomerPanel
        selected={customer}
        dailyPurchaseLimitOz={dailyPurchaseLimitOz}
        cartIsEmpty={cart.length === 0}
        onSelect={setCustomer}
        onClear={() => setCustomer(null)}
        onDiscountFromRedeem={applyRedeemedDiscount}
      />

      {cart.length === 0 ? (
        <p className="text-xs text-gray-400">Cart is empty — scan an item to begin.</p>
      ) : (
        <div className="space-y-2">
          {cart.map((line) => {
            const lineMg = thcMgForLine(line);
            const lineGross = line.quantity * line.unitPrice;
            const lineNet = Math.max(0, lineGross - line.discountAmount);
            return (
              <div
                key={line.lotId}
                className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-2 text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{line.productName}</p>
                    <p className="text-gray-400">
                      {money(line.unitPrice)} / {line.unit}
                      {lineMg !== null && ` · ≈${lineMg.toFixed(0)}mg THC`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      max={line.quantityRemaining}
                      value={line.quantity}
                      onChange={(e) => updateQuantity(line.lotId, Number(e.target.value))}
                      className="w-16 border border-gray-300 dark:border-gray-700 rounded px-1 py-1 bg-transparent text-right"
                    />
                    <span className="w-16 text-right">
                      {line.discountAmount > 0 && (
                        <span className="text-gray-400 line-through mr-1">{money(lineGross)}</span>
                      )}
                      {money(lineNet)}
                    </span>
                    <button onClick={() => removeLine(line.lotId)} className="text-red-500 px-1">
                      ×
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-1.5 text-gray-400">
                  <label htmlFor={`discount-${line.lotId}`}>Discount $</label>
                  <input
                    id={`discount-${line.lotId}`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.discountAmount || ""}
                    onChange={(e) => updateDiscount(line.lotId, Number(e.target.value))}
                    placeholder="0.00"
                    className="w-16 border border-gray-300 dark:border-gray-700 rounded px-1 py-1 bg-transparent text-right"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {cart.length > 0 && anyThcComputed && (
        <p className="text-xs text-gray-400">
          ≈{totalThcMg.toFixed(0)}mg total THC (≈{(totalThcMg / STANDARD_DOSE_MG).toFixed(1)} standard 10mg
          doses) — approximate, for reference only, not a certified dosing calculation. Liquid concentrate
          isn&apos;t included (needs density, not weight/count).
        </p>
      )}

      {cart.length > 0 && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <label className="text-gray-500 dark:text-gray-400">Tax rate</label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="0"
                step="0.1"
                value={taxRatePercent}
                onChange={(e) => setTaxRatePercent(Number(e.target.value))}
                className="w-16 border border-gray-300 dark:border-gray-700 rounded px-1 py-1 bg-transparent text-right"
              />
              <span>%</span>
            </div>
          </div>
          <div className="flex items-center justify-between text-xs">
            <label className="text-gray-500 dark:text-gray-400">Tender</label>
            <select
              value={tenderType}
              onChange={(e) => setTenderType(e.target.value as "cash" | "card" | "other")}
              className="border border-gray-300 dark:border-gray-700 rounded px-2 py-1 bg-transparent"
            >
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="flex items-center justify-between text-xs">
            <label className="text-gray-500 dark:text-gray-400">Order type</label>
            <select
              value={orderType}
              onChange={(e) => setOrderType(e.target.value as "in_store" | "pickup" | "curbside")}
              className="border border-gray-300 dark:border-gray-700 rounded px-2 py-1 bg-transparent"
            >
              <option value="in_store">In-store</option>
              <option value="pickup">Pickup</option>
              <option value="curbside">Curbside</option>
            </select>
          </div>
          <div className="flex items-center justify-between text-xs">
            <label className="text-gray-500 dark:text-gray-400">Customer name (optional)</label>
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="For the receipt"
              className="w-36 border border-gray-300 dark:border-gray-700 rounded px-2 py-1 bg-transparent"
            />
          </div>
          <div className="text-xs space-y-1 pt-1 border-t border-gray-200 dark:border-gray-800">
            <div className="flex justify-between text-gray-500 dark:text-gray-400">
              <span>Subtotal</span>
              <span>{money(subtotal)}</span>
            </div>
            <div className="flex justify-between text-gray-500 dark:text-gray-400">
              <span>Tax</span>
              <span>{money(taxAmount)}</span>
            </div>
            <div className="flex justify-between font-semibold text-gray-900 dark:text-gray-100">
              <span>Total</span>
              <span>{money(total)}</span>
            </div>
          </div>
          <button
            onClick={completeSale}
            disabled={pending}
            className="w-full bg-green-700 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50"
          >
            {pending ? "Completing…" : "Complete sale"}
          </button>
        </div>
      )}
    </div>
  );
}
