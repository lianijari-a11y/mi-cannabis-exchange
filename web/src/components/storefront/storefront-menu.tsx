"use client";

import { useState, useTransition } from "react";
import { Leaf, Droplet } from "lucide-react";
import { CATEGORY_LABELS, type Category } from "@/lib/constants";
import { placeOrderAction } from "@/app/order/[slug]/actions";

type MenuItem = {
  id: string;
  sku: string;
  productName: string;
  category: string;
  thcPercent: number | null;
  thcMgPerUnit: number | null;
  unit: string;
  retailPricePerUnit: number;
  quantityRemaining: number;
};

type CartLine = MenuItem & { quantity: number };

const money = (n: number) => `$${n.toFixed(2)}`;

// Visual conventions match components/retailer/listing-card.tsx (green-700
// accents, Leaf-icon placeholder, THC badge, category pill) so this reads
// as part of the same product rather than a bolted-on different app — see
// CLAUDE.md §25 on why there's no product photo here (InventoryLot has
// none, and joining back to the wholesale Listing's photos is unsafe).
export function StorefrontMenu({ slug, businessName, items }: { slug: string; businessName: string; items: MenuItem[] }) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [showCheckout, setShowCheckout] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [ageAttested, setAgeAttested] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [pickupNote, setPickupNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function addToCart(item: MenuItem) {
    setCart((prev) => {
      const existing = prev.find((l) => l.id === item.id);
      if (existing) {
        return prev.map((l) =>
          l.id === item.id ? { ...l, quantity: Math.min(l.quantity + 1, item.quantityRemaining) } : l
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  }

  function updateQuantity(id: string, quantity: number) {
    setCart((prev) => prev.map((l) => (l.id === id ? { ...l, quantity } : l)));
  }

  function removeLine(id: string) {
    setCart((prev) => prev.filter((l) => l.id !== id));
  }

  const total = cart.reduce((sum, l) => sum + l.quantity * l.retailPricePerUnit, 0);

  function submitOrder() {
    setError(null);
    if (!ageAttested) {
      setError("You must confirm you're 21 or older to place an order.");
      return;
    }
    startTransition(async () => {
      try {
        await placeOrderAction(
          slug,
          customerName,
          customerPhone,
          ageAttested,
          cart.map((l) => ({ lotId: l.id, quantity: l.quantity })),
          pickupNote,
          marketingOptIn
        );
      } catch (err) {
        // redirect() signals via a thrown object with a "NEXT_REDIRECT"-
        // prefixed .digest, not a normal Error — let that one propagate
        // (Next's client runtime handles the actual navigation) and only
        // surface anything else as a real error.
        const digest = (err as { digest?: string })?.digest;
        if (digest?.startsWith("NEXT_REDIRECT")) throw err;
        setError(err instanceof Error ? err.message : "Couldn't place your order.");
      }
    });
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logos/xcelerate-icon.png" alt="Xcelerate POS" className="w-8 h-8 rounded-lg object-cover" />
        <span className="text-xs text-gray-500 dark:text-gray-400">Xcelerate POS</span>
      </div>
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-1">{businessName}</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Order ahead and pick up in store — pay when you collect it.
      </p>

      {items.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Nothing available to order right now.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden"
            >
              <div className="relative aspect-[4/3] bg-gradient-to-br from-green-50 to-gray-100 dark:from-green-950/40 dark:to-gray-800 flex items-center justify-center">
                <Leaf className="w-10 h-10 text-green-700/30 dark:text-green-400/20" />
                <span className="absolute top-2 left-2 text-[10px] font-medium uppercase tracking-wide bg-white/90 dark:bg-gray-900/90 text-gray-700 dark:text-gray-200 px-2 py-1 rounded-full backdrop-blur-sm">
                  {CATEGORY_LABELS[item.category as Category] ?? item.category}
                </span>
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 leading-snug">{item.productName}</h3>
                <div className="mt-2 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                  {item.thcPercent != null && (
                    <span className="inline-flex items-center gap-1">
                      <Droplet className="w-3 h-3 text-green-600" />
                      {item.thcPercent}% THC
                    </span>
                  )}
                  {item.thcMgPerUnit != null && (
                    <span className="inline-flex items-center gap-1">
                      <Droplet className="w-3 h-3 text-green-600" />
                      {item.thcMgPerUnit}mg THC
                    </span>
                  )}
                  <span>{item.quantityRemaining} {item.unit} left</span>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-lg font-semibold text-green-700 dark:text-green-400">
                    {money(item.retailPricePerUnit)}
                    <span className="text-xs font-normal text-gray-400"> /{item.unit}</span>
                  </p>
                  <button
                    onClick={() => addToCart(item)}
                    className="bg-green-700 text-white rounded-lg px-3 py-1.5 text-xs font-medium"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 p-4">
          <div className="max-w-5xl mx-auto">
            {!showCheckout ? (
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <span className="text-gray-500 dark:text-gray-400">
                    {cart.reduce((n, l) => n + l.quantity, 0)} item{cart.length === 1 ? "" : "s"}
                  </span>{" "}
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{money(total)}</span>
                </div>
                <button
                  onClick={() => setShowCheckout(true)}
                  className="bg-green-700 text-white rounded-lg px-4 py-2 text-sm font-medium"
                >
                  Review order
                </button>
              </div>
            ) : (
              <div className="space-y-3 max-w-md">
                <div className="space-y-1 max-h-32 overflow-y-auto text-xs">
                  {cart.map((line) => (
                    <div key={line.id} className="flex items-center justify-between gap-2">
                      <span className="text-gray-700 dark:text-gray-300">{line.productName}</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          max={line.quantityRemaining}
                          value={line.quantity}
                          onChange={(e) => updateQuantity(line.id, Number(e.target.value))}
                          className="w-14 border border-gray-300 dark:border-gray-700 rounded px-1 py-0.5 bg-transparent text-right"
                        />
                        <span className="w-14 text-right">{money(line.quantity * line.retailPricePerUnit)}</span>
                        <button onClick={() => removeLine(line.id)} className="text-red-500 px-1">
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Your name"
                  className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-transparent"
                />
                <input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Phone number"
                  type="tel"
                  className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-transparent"
                />
                <input
                  value={pickupNote}
                  onChange={(e) => setPickupNote(e.target.value)}
                  placeholder="Pickup note, optional (e.g. today after 3pm)"
                  className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-transparent"
                />
                <label className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400">
                  <input
                    type="checkbox"
                    checked={ageAttested}
                    onChange={(e) => setAgeAttested(e.target.checked)}
                    className="mt-0.5"
                  />
                  I confirm I am 21 years of age or older. I understand my ID will be checked at pickup.
                </label>
                <label className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400">
                  <input
                    type="checkbox"
                    checked={marketingOptIn}
                    onChange={(e) => setMarketingOptIn(e.target.checked)}
                    className="mt-0.5"
                  />
                  Text me about specials and deals from {businessName} (optional — you can opt out anytime).
                </label>
                {error && <p className="text-xs text-red-600">{error}</p>}
                <div className="flex items-center justify-between text-sm font-semibold text-gray-900 dark:text-gray-100">
                  <span>Total (pay at pickup)</span>
                  <span>{money(total)}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowCheckout(false)}
                    className="flex-1 border border-gray-300 dark:border-gray-700 rounded-lg py-2 text-sm font-medium"
                  >
                    Back
                  </button>
                  <button
                    onClick={submitOrder}
                    disabled={pending}
                    className="flex-1 bg-green-700 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50"
                  >
                    {pending ? "Placing…" : "Place order"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
