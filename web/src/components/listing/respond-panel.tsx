"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { respondToListingAsRetailer } from "@/lib/public-respond-actions";
import {
  searchRetailerLicenseRegistry,
  createRetailerAccountForAdmin,
  searchExistingRetailers,
  type CreateRetailerResult,
} from "@/lib/admin-retailer-assist";
import type { LicenseSearchResult } from "@/lib/assisted-seller-signup";
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
// in (nobody yet, an existing Retailer, or Admin acting on a retailer's
// behalf) shows the matching path before the action actually writes
// anything — the write itself is always the same call to
// respondToListingAsRetailer regardless of which path got there.
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

  if (sessionRole === "admin") {
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
    return <AdminRetailerPicker onResolved={setAdminRetailerId} />;
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

const SEARCH_MODES = [
  { value: "number", label: "License #" },
  { value: "name", label: "Business name" },
  { value: "phone", label: "Phone" },
] as const;

function AdminRetailerPicker({ onResolved }: { onResolved: (r: { id: string; businessName: string }) => void }) {
  const [tab, setTab] = useState<"existing" | "new">("existing");
  const [query, setQuery] = useState("");
  const [existingResults, setExistingResults] = useState<{ id: string; businessName: string | null; fullName: string; email: string }[]>([]);
  const [searchMode, setSearchMode] = useState<(typeof SEARCH_MODES)[number]["value"]>("phone");
  const [regResults, setRegResults] = useState<LicenseSearchResult[]>([]);
  const [selected, setSelected] = useState<LicenseSearchResult | null>(null);
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  function runExistingSearch() {
    startTransition(async () => setExistingResults(await searchExistingRetailers(query)));
  }
  function runRegSearch() {
    startTransition(async () => setRegResults(await searchRetailerLicenseRegistry(query, searchMode)));
  }

  function createAccount() {
    if (!selected) return;
    setError(undefined);
    const formData = new FormData();
    formData.set("licenseNumber", selected.licenseNumber);
    formData.set("contactName", contactName);
    formData.set("email", email);
    formData.set("password", password);
    startTransition(async () => {
      const r: CreateRetailerResult = await createRetailerAccountForAdmin(formData);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      onResolved({ id: r.retailerId, businessName: r.businessName });
    });
  }

  return (
    <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-3 space-y-3">
      <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
        Find or create the retailer account you&apos;re submitting on behalf of
      </p>
      <div className="flex gap-1.5">
        <button type="button" onClick={() => setTab("existing")} className={`text-[11px] px-2 py-1 rounded-md border ${tab === "existing" ? "bg-green-700 text-white border-green-700" : "border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400"}`}>
          Existing account
        </button>
        <button type="button" onClick={() => setTab("new")} className={`text-[11px] px-2 py-1 rounded-md border ${tab === "new" ? "bg-green-700 text-white border-green-700" : "border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400"}`}>
          Create new
        </button>
      </div>

      {tab === "existing" ? (
        <div>
          <div className="flex gap-2">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Business name or email" className={inputClass + " mt-0"} />
            <button type="button" onClick={runExistingSearch} disabled={pending || !query.trim()} className="shrink-0 bg-green-700 text-white rounded-lg px-3 py-2 text-xs font-medium disabled:opacity-50">
              Search
            </button>
          </div>
          {existingResults.length > 0 && (
            <div className="mt-2 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
              {existingResults.map((r) => (
                <button key={r.id} type="button" onClick={() => onResolved({ id: r.id, businessName: r.businessName ?? r.fullName })} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-800 last:border-b-0">
                  <span className="font-medium text-gray-900 dark:text-gray-100">{r.businessName ?? r.fullName}</span>{" "}
                  <span className="text-gray-400">— {r.email}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : !selected ? (
        <div>
          <div className="flex gap-1.5">
            {SEARCH_MODES.map((m) => (
              <button key={m.value} type="button" onClick={() => setSearchMode(m.value)} className={`text-[11px] px-2 py-1 rounded-md border ${searchMode === m.value ? "bg-green-700 text-white border-green-700" : "border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400"}`}>
                {m.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2 mt-1.5">
            <input value={query} onChange={(e) => setQuery(e.target.value)} className={inputClass + " mt-0"} />
            <button type="button" onClick={runRegSearch} disabled={pending || !query.trim()} className="shrink-0 bg-green-700 text-white rounded-lg px-3 py-2 text-xs font-medium disabled:opacity-50">
              Search
            </button>
          </div>
          {regResults.length > 0 && (
            <div className="mt-2 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
              {regResults.map((r) => (
                <button key={r.licenseNumber} type="button" onClick={() => setSelected(r)} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-800 last:border-b-0">
                  <span className="font-medium text-gray-900 dark:text-gray-100">{r.businessName}</span>{" "}
                  <span className="text-gray-400">— {r.licenseNumber} · {r.city ?? "?"}, {r.state ?? "MI"} · {r.status}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-lg border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-900/20 p-2.5">
            <p className="text-xs text-green-800 dark:text-green-300">
              <span className="font-medium">{selected.businessName}</span> — {selected.licenseNumber}
            </p>
            <button type="button" onClick={() => setSelected(null)} className="text-[11px] text-gray-500 dark:text-gray-400 underline mt-1">
              Choose a different license
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass} htmlFor="retContactName">Contact name</label>
              <input id="retContactName" value={contactName} onChange={(e) => setContactName(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass} htmlFor="retEmail">Email</label>
              <input id="retEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
            </div>
          </div>
          <div>
            <label className={labelClass} htmlFor="retPassword">Temporary password</label>
            <input id="retPassword" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" className={inputClass} />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            type="button"
            onClick={createAccount}
            disabled={pending || !contactName.trim() || !email.trim() || password.length < 8}
            className="bg-green-700 text-white rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50"
          >
            {pending ? "Creating…" : "Create account & continue"}
          </button>
        </div>
      )}
    </div>
  );
}
