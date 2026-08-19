"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { respondToListingAsRetailer } from "@/lib/public-respond-actions";
import { RetailerPicker } from "@/components/shared/retailer-picker";
import { TERMS, TERMS_LABELS, type Terms } from "@/lib/constants";

const inputClass =
  "w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm mt-1 bg-transparent";
const labelClass = "text-xs text-gray-500 dark:text-gray-400";

type Action = "accept" | "counter" | "decline";

const ACTION_LABEL: Record<Action, string> = {
  accept: "Accept this listing",
  counter: "Send a counter-offer",
  decline: "Decline this listing",
};

// Drives the gated part of a shared listing link (CLAUDE.md §36): whoever
// clicked Accept/Counter/Decline lands here, and depending on who's signed
// in (nobody yet, an existing Retailer, or Admin/Account Executive acting
// on a retailer's behalf) shows the matching path before the action
// actually writes anything — the write itself is always the same call to
// respondToListingAsRetailer regardless of which path got there. AE access
// to the assisted-retailer picker was added later, on direct request — see
// lib/admin-retailer-assist.ts's and lib/public-respond-actions.ts's own
// comments for the reversal this represents.
export function RespondPanel({
  listingId,
  action,
  sessionRole,
  sessionUserId,
  defaultPrice,
  defaultTerms,
}: {
  listingId: string;
  action: Action;
  sessionRole: string | null;
  sessionUserId: string | null;
  defaultPrice: number;
  defaultTerms: string;
}) {
  const [adminRetailerId, setAdminRetailerId] = useState<{ id: string; businessName: string } | null>(null);

  if (sessionRole === "retailer" && sessionUserId) {
    return <ActionForm listingId={listingId} retailerId={sessionUserId} action={action} defaultPrice={defaultPrice} defaultTerms={defaultTerms} />;
  }

  if (sessionRole === "admin" || sessionRole === "sales_rep") {
    if (adminRetailerId) {
      return (
        <div className="space-y-3">
          <p className="text-xs text-green-700 dark:text-green-400">
            Acting on behalf of {adminRetailerId.businessName}
          </p>
          <ActionForm
            listingId={listingId}
            retailerId={adminRetailerId.id}
            action={action}
            defaultPrice={defaultPrice}
            defaultTerms={defaultTerms}
          />
        </div>
      );
    }
    return <RetailerPicker onResolved={setAdminRetailerId} />;
  }

  if (sessionRole) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        This link is for Retailer accounts. You&apos;re signed in as a different role — sign out and
        use a Retailer account, or ask an Admin to submit this on your behalf.
      </p>
    );
  }

  const self = `/listing/${listingId}/respond?action=${action}`;
  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        To {ACTION_LABEL[action].toLowerCase()}, sign in to your Retailer account or create one —
        it only takes your state license number.
      </p>
      <div className="flex gap-2">
        <Link
          href={`/signup?role=retailer&callbackUrl=${encodeURIComponent(self)}`}
          className="bg-green-700 hover:bg-green-800 text-white rounded-lg px-4 py-2 text-sm font-medium"
        >
          Create Retailer account
        </Link>
        <Link
          href={`/login?callbackUrl=${encodeURIComponent(self)}`}
          className="border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg px-4 py-2 text-sm font-medium"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}

function ActionForm({
  listingId,
  retailerId,
  action,
  defaultPrice,
  defaultTerms,
}: {
  listingId: string;
  retailerId: string;
  action: Action;
  defaultPrice: number;
  defaultTerms: string;
}) {
  const [price, setPrice] = useState(String(defaultPrice));
  const [terms, setTerms] = useState(defaultTerms);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const r = await respondToListingAsRetailer(listingId, retailerId, action === "decline" ? "reject" : action, {
        price: action === "counter" ? Number(price) : undefined,
        terms: action === "counter" ? terms : undefined,
        message: message || undefined,
      });
      setResult(r.ok ? { ok: true } : { ok: false, error: r.error });
    });
  }

  if (result?.ok) {
    return (
      <div className="rounded-lg border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-900/20 p-3">
        <p className="text-sm text-green-800 dark:text-green-300">
          ✓ {action === "decline" ? "Declined." : action === "counter" ? "Counter-offer sent." : "Accepted."}
        </p>
        <Link href={`/retailer/listings/${listingId}`} className="text-xs text-green-700 dark:text-green-400 underline mt-1 inline-block">
          View this negotiation
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {action === "counter" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} htmlFor="counterPrice">Your price</label>
            <input id="counterPrice" type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="counterTerms">Terms</label>
            <select id="counterTerms" value={terms} onChange={(e) => setTerms(e.target.value)} className={inputClass}>
              {TERMS.map((t) => (
                <option key={t} value={t}>{TERMS_LABELS[t as Terms]}</option>
              ))}
            </select>
          </div>
        </div>
      )}
      <div>
        <label className={labelClass} htmlFor="respondMessage">Message (optional)</label>
        <textarea id="respondMessage" rows={2} value={message} onChange={(e) => setMessage(e.target.value)} className={inputClass} />
      </div>
      {result?.error && <p className="text-xs text-red-600">{result.error}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="bg-green-700 hover:bg-green-800 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {pending ? "Submitting…" : ACTION_LABEL[action]}
      </button>
    </div>
  );
}
