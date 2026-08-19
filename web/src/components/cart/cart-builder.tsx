"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CATEGORY_LABELS, TERMS, TERMS_LABELS, type Category, type Terms } from "@/lib/constants";
import { submitPublicCartOrder } from "@/lib/public-cart-actions";
import type { CartItemInput } from "@/lib/cart-orders";

type Media = { id: string; url: string; type: string };
type CartListing = {
  id: string;
  strainName: string;
  category: string;
  thcPercent: number | null;
  quantity: number;
  unit: string;
  pricePerUnit: number;
  terms: string;
  minimumOrderQuantity: number | null;
  belowMinimumPricePerUnit: number | null;
  media: Media[];
};
type CartSeller = { anonHandle: string; listings: CartListing[] };

// The multi-product selection + submission UI shared by /menu/[batchId]
// (one seller) and /collection/[id] (possibly several) — CLAUDE.md §40.
// Picking quantities across multiple products and submitting once creates
// one ordinary OfferThread per selected product behind the scenes
// (lib/cart-orders.ts), so nothing about how a seller responds to any one
// of them is different from a normal single-listing offer.
export function CartBuilder({
  sellers,
  collectionId,
  sessionRole,
  callbackUrl,
}: {
  sellers: CartSeller[];
  collectionId?: string;
  sessionRole: string | null;
  callbackUrl: string;
}) {
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [terms, setTerms] = useState<Terms>("cash");
  const [result, setResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function effectivePrice(listing: CartListing, qty: number): number {
    if (
      listing.minimumOrderQuantity != null &&
      listing.belowMinimumPricePerUnit != null &&
      qty > 0 &&
      qty < listing.minimumOrderQuantity
    ) {
      return listing.belowMinimumPricePerUnit;
    }
    return listing.pricePerUnit;
  }

  const items: CartItemInput[] = useMemo(() => {
    const out: CartItemInput[] = [];
    for (const seller of sellers) {
      for (const listing of seller.listings) {
        const qty = Number(quantities[listing.id] ?? 0);
        if (qty > 0) out.push({ listingId: listing.id, quantity: qty, price: effectivePrice(listing, qty) });
      }
    }
    return out;
  }, [quantities, sellers]);

  const total = items.reduce((sum, i) => sum + i.quantity * i.price, 0);

  async function submit() {
    setResult(null);
    setSubmitting(true);
    const r = await submitPublicCartOrder(collectionId, items, terms);
    setSubmitting(false);
    setResult(r.ok ? { ok: true } : { ok: false, error: r.error });
  }

  if (result?.ok) {
    return (
      <div className="rounded-xl border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-900/20 p-4">
        <p className="text-sm text-green-800 dark:text-green-300">
          ✓ Order submitted — {items.length} product{items.length === 1 ? "" : "s"} sent to the
          seller{sellers.length > 1 ? "s" : ""} for review.
        </p>
        <Link href="/retailer/negotiations" className="text-xs text-green-700 dark:text-green-400 underline mt-1 inline-block">
          View your negotiations
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {sellers.map((seller) => (
        <div key={seller.anonHandle}>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">{seller.anonHandle}</h2>
          <div className="space-y-2">
            {seller.listings.map((listing) => {
              const qty = Number(quantities[listing.id] ?? 0);
              const price = effectivePrice(listing, qty);
              const tiered =
                listing.minimumOrderQuantity != null &&
                listing.belowMinimumPricePerUnit != null;
              return (
                <div
                  key={listing.id}
                  className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {listing.strainName}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {CATEGORY_LABELS[listing.category as Category] ?? listing.category}
                      {listing.thcPercent != null ? ` · ${listing.thcPercent}% THC` : ""} ·{" "}
                      {listing.quantity} {listing.unit} available
                    </p>
                    {tiered && (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">
                        ${listing.pricePerUnit}/{listing.unit} at {listing.minimumOrderQuantity}+{" "}
                        {listing.unit}, ${listing.belowMinimumPricePerUnit}/{listing.unit} below that
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={quantities[listing.id] ?? ""}
                      onChange={(e) =>
                        setQuantities((q) => ({ ...q, [listing.id]: e.target.value }))
                      }
                      placeholder="0"
                      className="w-20 border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1 text-sm text-right bg-transparent"
                    />
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {qty > 0 ? `$${price}/${listing.unit} · $${(qty * price).toFixed(2)}` : `$${listing.pricePerUnit}/${listing.unit}`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 sticky bottom-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {items.length} product{items.length === 1 ? "" : "s"} selected
          </span>
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            ${total.toFixed(2)}
          </span>
        </div>

        <div className="mb-3">
          <label className="text-xs text-gray-500 dark:text-gray-400" htmlFor="cart-terms">
            Payment terms
          </label>
          <select
            id="cart-terms"
            value={terms}
            onChange={(e) => setTerms(e.target.value as Terms)}
            className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm mt-1 bg-transparent"
          >
            {TERMS.map((t) => (
              <option key={t} value={t}>
                {TERMS_LABELS[t]}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-gray-400 mt-1">
            Smaller orders typically require cash on delivery — a seller can agree to other terms,
            but that&apos;s their own call to make.
          </p>
        </div>

        {result?.error && <p className="text-xs text-red-600 mb-2">{result.error}</p>}

        {sessionRole === "retailer" ? (
          <button
            type="button"
            onClick={submit}
            disabled={items.length === 0 || submitting}
            className="w-full bg-green-700 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Submit order"}
          </button>
        ) : sessionRole ? (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            This link is for Retailer accounts to place an order.
          </p>
        ) : (
          <div className="flex gap-2">
            <Link
              href={`/signup?role=retailer&callbackUrl=${encodeURIComponent(callbackUrl)}`}
              className="flex-1 text-center bg-green-700 hover:bg-green-800 text-white rounded-lg px-4 py-2 text-sm font-medium"
            >
              Create Retailer account
            </Link>
            <Link
              href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}
              className="flex-1 text-center border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg px-4 py-2 text-sm font-medium"
            >
              Sign in
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
