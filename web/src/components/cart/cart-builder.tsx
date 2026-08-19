"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Leaf, Minus, Plus, X } from "lucide-react";
import Link from "next/link";
import { CATEGORY_LABELS, TERMS, TERMS_LABELS, type Category, type Terms } from "@/lib/constants";
import { submitPublicCartOrder } from "@/lib/public-cart-actions";
import { LicenseAuthFlow } from "@/components/cart/license-auth-flow";
import { RetailerPicker } from "@/components/shared/retailer-picker";
import { TermsDisclaimer } from "@/components/cart/terms-disclaimer";
import { CartBulkPriceAdjust } from "@/components/cart/cart-bulk-price-adjust";
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
// The default quantities every listing starts at: the full amount the
// seller listed — "the cart has 0 for each product, it should display the
// full amount available as that is the wholesale offer to the retailer."
// This is what makes "Accept offer" with nothing touched a genuine,
// full-menu accept.
function fullOfferQuantities(sellers: CartSeller[]): Record<string, string> {
  const init: Record<string, string> = {};
  for (const seller of sellers) {
    for (const listing of seller.listings) init[listing.id] = String(listing.quantity);
  }
  return init;
}

export function CartBuilder({
  sellers,
  collectionId,
  sessionRole,
}: {
  sellers: CartSeller[];
  collectionId?: string;
  sessionRole: string | null;
}) {
  const [quantities, setQuantities] = useState<Record<string, string>>(() => fullOfferQuantities(sellers));
  // Per-product price overrides for a counter-offer — "in a counter offer
  // it should allow retailer to make an offer per product that is
  // different than the one offered." Empty/absent means "use the
  // seller's own price" (tiered price if this quantity qualifies); a
  // present entry means the retailer has typed their own number for that
  // line, which flows straight through as that line's CartItemInput.price.
  const [priceOverrides, setPriceOverrides] = useState<Record<string, string>>({});
  // Terms default to whatever the first listing already offers — matching
  // it exactly is what lets "Accept offer" resolve to a true accept
  // server-side (lib/cart-orders.ts compares requestedTerms against each
  // listing's own terms) instead of silently becoming a counter on terms
  // alone the instant the retailer hasn't touched anything.
  const [terms, setTerms] = useState<Terms>(
    (sellers[0]?.listings[0]?.terms as Terms) ?? "cash"
  );
  const [result, setResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const [declined, setDeclined] = useState(false);
  const [submitting, setSubmitting] = useState<"accept" | "counter" | null>(null);
  const [lightbox, setLightbox] = useState<{ url: string; type: string; alt: string } | null>(null);
  // "The bottom half has a small window that says the total price, number
  // of products, payment terms, create retailer, etc — would be nice if a
  // person wanted to minimize this window some downward to better see the
  // menu." Collapses everything below the total/product-count summary row,
  // which stays sticky-visible on its own — the menu above gets the rest
  // of the screen. Starts expanded so the buttons are never hidden by
  // default; a visitor scrolling a long menu can shrink it down themselves.
  const [panelMinimized, setPanelMinimized] = useState(false);
  // Buttons are always visible up front (the human's own spec) — clicking
  // Accept/Counter while not signed in as a retailer opens the
  // license-first inline auth flow instead of submitting immediately;
  // `pendingAction` remembers which one to resume once it succeeds.
  const [pendingAction, setPendingAction] = useState<"accept" | "counter" | null>(null);
  const [justAuthenticated, setJustAuthenticated] = useState(false);
  const isRetailer = sessionRole === "retailer" || justAuthenticated;
  // "So can account executives and admin" — an AE/Admin can now also
  // submit through this same cart page on a retailer's behalf, mirroring
  // the single-listing respond flow's admin/AE-assisted picker (§36/
  // §49-C). `assistedRetailer` is the resolved (found-or-created) account
  // they're acting for; an AE additionally has to acknowledge the same
  // liability disclaimer §41 already requires before building a
  // shareable collection link, since submitting a cart order on someone's
  // behalf is the same kind of AE-facilitated event.
  const isAssistant = sessionRole === "admin" || sessionRole === "sales_rep";
  const [assistedRetailer, setAssistedRetailer] = useState<{ id: string; businessName: string } | null>(null);
  const [disclaimerAcknowledged, setDisclaimerAcknowledged] = useState(false);
  const canAct =
    isRetailer || (isAssistant && !!assistedRetailer && (sessionRole !== "sales_rep" || disclaimerAcknowledged));

  function suggestedPrice(listing: CartListing, qty: number): number {
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

  // The seller's own price unless the retailer typed a different one for
  // this line — that override is a real per-product price counter-offer,
  // not just a display value.
  function effectivePrice(listing: CartListing, qty: number): number {
    const override = priceOverrides[listing.id];
    if (override !== undefined && override !== "") return Number(override);
    return suggestedPrice(listing, qty);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quantities, priceOverrides, sellers]);

  const total = items.reduce((sum, i) => sum + i.quantity * i.price, 0);

  // Whether the cart, as it currently stands, still matches the seller's
  // original offer exactly (full quantity, listing price, listing terms
  // on every line) — drives which button reads as the "obvious" one, not
  // a hard gate.
  const matchesFullOffer = useMemo(() => {
    for (const seller of sellers) {
      for (const listing of seller.listings) {
        const qty = Number(quantities[listing.id] ?? 0);
        if (qty !== listing.quantity) return false;
        if (listing.terms !== terms) return false;
        const override = priceOverrides[listing.id];
        if (override !== undefined && override !== "" && Number(override) !== listing.pricePerUnit) return false;
      }
    }
    return true;
  }, [quantities, terms, priceOverrides, sellers]);

  // Flattened, current-state view of every line for the bulk-adjust tool
  // — "the buyers should be able to bulk adjust price when doing a
  // counter offer, so can account executives and admin" (the latter two
  // once they're acting through the same UI via the retailer picker
  // above). Labels include the seller's anon handle only when a
  // collection spans more than one seller, so a single-seller menu link
  // stays uncluttered.
  const bulkAdjustLines = useMemo(
    () =>
      sellers.flatMap((seller) =>
        seller.listings.map((listing) => {
          const qty = Number(quantities[listing.id] ?? 0) || listing.quantity;
          return {
            id: listing.id,
            label: sellers.length > 1 ? `${listing.strainName} (${seller.anonHandle})` : listing.strainName,
            price: effectivePrice(listing, qty),
            quantity: qty,
            unit: listing.unit,
          };
        })
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sellers, quantities, priceOverrides]
  );

  function applyBulkPriceAdjust(mode: "percent" | "setPrice", value: number, ids: string[]) {
    const idSet = new Set(ids);
    setPriceOverrides((prev) => {
      const next = { ...prev };
      for (const line of bulkAdjustLines) {
        if (!idSet.has(line.id)) continue;
        const newPrice = mode === "setPrice" ? value : line.price * (1 + value / 100);
        next[line.id] = String(Math.max(0.01, Math.round(newPrice * 100) / 100));
      }
      return next;
    });
  }

  function adjustQty(listingId: string, delta: number, max: number, step: number) {
    setQuantities((q) => {
      const current = Number(q[listingId] ?? 0);
      const raw = current + delta * step;
      const next = Math.min(Math.max(raw, 0), max);
      return { ...q, [listingId]: String(Math.round(next * 100) / 100) };
    });
  }

  async function doSubmit(kind: "accept" | "counter", itemsToSend: CartItemInput[], termsToSend: Terms) {
    setResult(null);
    setSubmitting(kind);
    const r = await submitPublicCartOrder(collectionId, itemsToSend, termsToSend, assistedRetailer?.id);
    setSubmitting(null);
    setResult(r.ok ? { ok: true } : { ok: false, error: r.error });
  }

  // "Accept offer" always submits the seller's full original menu — full
  // quantity, listing price, listing terms on every line — regardless of
  // whatever the retailer may have been fiddling with in the quantity
  // boxes, so it's never ambiguous what clicking it does. Computed and
  // sent directly rather than through setState-then-read, since a state
  // setter's new value isn't visible until the next render.
  //
  // `skipAuthGate` is only ever passed `true` from handleAuthenticated,
  // right after the license-first flow just finished — passed explicitly
  // rather than re-reading `isRetailer` from state, since a state update
  // triggered moments earlier isn't guaranteed visible yet in this same
  // call.
  function acceptOffer(skipAuthGate?: boolean) {
    if (!canAct && !skipAuthGate) {
      // The license-first flow is only ever the right next step for an
      // anonymous visitor or a not-yet-authenticated retailer — an AE/
      // Admin session that hasn't picked a retailer yet (or hasn't
      // acknowledged the disclaimer) never gets here in practice, since
      // the buttons themselves aren't rendered until canAct is true, but
      // guard it explicitly rather than relying on that alone.
      if (!isAssistant) setPendingAction("accept");
      return;
    }
    const fullItems: CartItemInput[] = sellers.flatMap((seller) =>
      seller.listings.map((listing) => ({
        listingId: listing.id,
        quantity: listing.quantity,
        price: listing.pricePerUnit,
      }))
    );
    const fullTerms = (sellers[0]?.listings[0]?.terms as Terms) ?? "cash";
    setQuantities(fullOfferQuantities(sellers));
    setPriceOverrides({});
    setTerms(fullTerms);
    doSubmit("accept", fullItems, fullTerms);
  }

  function counterOffer(skipAuthGate?: boolean) {
    if (!canAct && !skipAuthGate) {
      if (!isAssistant) setPendingAction("counter");
      return;
    }
    doSubmit("counter", items, terms);
  }

  function handleAuthenticated() {
    setJustAuthenticated(true);
    const pending = pendingAction;
    setPendingAction(null);
    if (pending === "accept") acceptOffer(true);
    else if (pending === "counter") counterOffer(true);
  }

  if (declined) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
        <p className="text-sm text-gray-700 dark:text-gray-300">
          You declined this offer. Nothing was sent — the seller isn&apos;t notified either way.
        </p>
      </div>
    );
  }

  if (result?.ok) {
    return (
      <div className="rounded-xl border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-900/20 p-4">
        <p className="text-sm text-green-800 dark:text-green-300">
          ✓ {items.length} product{items.length === 1 ? "" : "s"} sent to the seller
          {sellers.length > 1 ? "s" : ""} for review.
        </p>
        <Link href="/retailer/negotiations" className="text-xs text-green-700 dark:text-green-400 underline mt-1 inline-block">
          View your negotiations
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <CartBulkPriceAdjust lines={bulkAdjustLines} onApply={applyBulkPriceAdjust} />

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
              const step = listing.unit === "liter" ? 0.1 : 1;
              const priceAdjusted = price !== suggestedPrice(listing, qty);
              const adjusted = qty !== listing.quantity || priceAdjusted;
              const cover = listing.media[0];
              return (
                <div
                  key={listing.id}
                  className={`bg-white dark:bg-gray-900 border rounded-xl p-3 flex items-center gap-3 ${
                    adjusted
                      ? "border-amber-300 dark:border-amber-800"
                      : "border-gray-200 dark:border-gray-800"
                  }`}
                >
                  {cover ? (
                    <button
                      type="button"
                      onClick={() => setLightbox({ url: cover.url, type: cover.type, alt: listing.strainName })}
                      className="w-14 h-14 shrink-0 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 cursor-zoom-in"
                      aria-label={`View larger photo of ${listing.strainName}`}
                    >
                      {cover.type === "video" ? (
                        <video src={cover.url} muted className="w-full h-full object-cover pointer-events-none" />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={cover.url}
                          alt={listing.strainName}
                          className="w-full h-full object-cover pointer-events-none"
                        />
                      )}
                    </button>
                  ) : (
                    <div className="w-14 h-14 shrink-0 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                      <Leaf className="w-5 h-5 text-gray-300 dark:text-gray-600" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {listing.strainName}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {CATEGORY_LABELS[listing.category as Category] ?? listing.category}
                      {listing.thcPercent != null ? ` · ${listing.thcPercent}% THC` : ""} ·{" "}
                      {listing.quantity} {listing.unit} offered
                    </p>
                    {tiered && (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">
                        ${listing.pricePerUnit}/{listing.unit} at {listing.minimumOrderQuantity}+{" "}
                        {listing.unit}, ${listing.belowMinimumPricePerUnit}/{listing.unit} below that
                      </p>
                    )}
                    {adjusted && (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">
                        {qty !== listing.quantity && priceAdjusted
                          ? `Quantity and price adjusted from the seller's offer`
                          : qty !== listing.quantity
                            ? `Adjusted from the full ${listing.quantity} ${listing.unit} offered`
                            : `Price adjusted from the seller's $${suggestedPrice(listing, qty)}/${listing.unit}`}{" "}
                        — this line will go back as a counter-offer.
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => adjustQty(listing.id, -1, listing.quantity, step)}
                        className="w-7 h-7 flex items-center justify-center border border-gray-300 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-300"
                        aria-label={`Decrease ${listing.strainName} quantity`}
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <input
                        type="number"
                        min="0"
                        max={listing.quantity}
                        step={step}
                        value={quantities[listing.id] ?? ""}
                        onChange={(e) =>
                          setQuantities((q) => ({ ...q, [listing.id]: e.target.value }))
                        }
                        className="w-16 border border-gray-300 dark:border-gray-700 rounded-lg px-1 py-1 text-sm text-right bg-transparent"
                      />
                      <button
                        type="button"
                        onClick={() => adjustQty(listing.id, 1, listing.quantity, step)}
                        className="w-7 h-7 flex items-center justify-center border border-gray-300 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-300"
                        aria-label={`Increase ${listing.strainName} quantity`}
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="flex items-center justify-end gap-1 mt-1">
                      <span className="text-[11px] text-gray-400">$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={priceOverrides[listing.id] ?? String(suggestedPrice(listing, qty))}
                        onChange={(e) =>
                          setPriceOverrides((p) => ({ ...p, [listing.id]: e.target.value }))
                        }
                        className={`w-16 border rounded-lg px-1 py-0.5 text-xs text-right bg-transparent ${
                          priceAdjusted
                            ? "border-amber-300 dark:border-amber-800"
                            : "border-gray-200 dark:border-gray-800"
                        }`}
                        aria-label={`${listing.strainName} price per ${listing.unit}`}
                      />
                      <span className="text-[11px] text-gray-400">/{listing.unit}</span>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {qty > 0 ? `$${(qty * price).toFixed(2)} total` : "—"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 sticky bottom-4">
        <button
          type="button"
          onClick={() => setPanelMinimized((m) => !m)}
          className="w-full flex items-center justify-between gap-2 mb-3"
          aria-expanded={!panelMinimized}
          aria-label={panelMinimized ? "Expand order panel" : "Minimize order panel"}
        >
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {items.length} product{items.length === 1 ? "" : "s"} selected
          </span>
          <span className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              ${total.toFixed(2)}
            </span>
            {panelMinimized ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </span>
        </button>

        {!panelMinimized && (
          <>
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

            {pendingAction ? (
              <LicenseAuthFlow onAuthenticated={handleAuthenticated} onCancel={() => setPendingAction(null)} />
            ) : isAssistant && !assistedRetailer ? (
              // Admin/AE — same "find or create the retailer account
              // you're submitting on behalf of" picker the single-listing
              // respond flow already uses (§36/§49-C), reused as-is.
              <RetailerPicker onResolved={setAssistedRetailer} />
            ) : isAssistant && sessionRole === "sales_rep" && !disclaimerAcknowledged ? (
              <div className="space-y-2">
                <p className="text-xs text-green-700 dark:text-green-400">
                  Acting on behalf of {assistedRetailer!.businessName}
                </p>
                <TermsDisclaimer />
                <label className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={disclaimerAcknowledged}
                    onChange={(e) => setDisclaimerAcknowledged(e.target.checked)}
                    className="w-4 h-4 mt-0.5"
                  />
                  I have read and understand the terms disclaimer above.
                </label>
              </div>
            ) : sessionRole && !isRetailer && !isAssistant ? (
              // Logged in as some other role entirely (grower/admin/etc) — the
              // license-first flow below is specifically for a Retailer to
              // sign in or create an account, which doesn't apply here.
              <p className="text-xs text-gray-500 dark:text-gray-400">
                This link is for Retailer accounts to place an order.
              </p>
            ) : (
              // Buttons are always visible up front, whether or not anyone's
              // signed in yet — clicking Accept/Counter is what triggers the
              // license-first sign-in flow (acceptOffer/counterOffer above),
              // not a separate "create an account first" landing state.
              <div>
                {isAssistant && assistedRetailer && (
                  <p className="text-xs text-green-700 dark:text-green-400 mb-2">
                    Acting on behalf of {assistedRetailer.businessName}
                  </p>
                )}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => acceptOffer()}
                    disabled={submitting !== null}
                    className="bg-green-700 text-white rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50"
                    title="Send the seller's full menu back exactly as offered"
                  >
                    {submitting === "accept" ? "Sending…" : "Accept offer"}
                  </button>
                  <button
                    type="button"
                    onClick={() => counterOffer()}
                    disabled={items.length === 0 || submitting !== null || matchesFullOffer}
                    className="border border-green-700 text-green-700 dark:text-green-400 rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50"
                    title={
                      matchesFullOffer
                        ? "Adjust a quantity, price tier, or terms above to counter"
                        : "Send your adjusted quantities/terms as a counter-offer"
                    }
                  >
                    {submitting === "counter" ? "Sending…" : "Counter offer"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeclined(true)}
                    disabled={submitting !== null}
                    className="border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-1 sm:p-6"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            className="absolute top-2 right-2 sm:top-4 sm:right-4 text-white/90 hover:text-white bg-black/40 rounded-full p-1.5 z-10"
            aria-label="Close"
          >
            <X className="w-7 h-7" />
          </button>
          {/* w-full h-full (not just max-w/max-h) so a small source photo
              still gets scaled UP to fill the screen — "big enough to see
              very good from a phone" — rather than only ever being capped
              down from a large one. object-contain keeps it uncropped. */}
          {lightbox.type === "video" ? (
            <video
              src={lightbox.url}
              controls
              autoPlay
              playsInline
              onClick={(e) => e.stopPropagation()}
              className="w-full h-full object-contain"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={lightbox.url}
              alt={lightbox.alt}
              onClick={(e) => e.stopPropagation()}
              className="w-full h-full object-contain"
            />
          )}
        </div>
      )}
    </div>
  );
}
