"use client";

import { useState, useTransition } from "react";
import { SellerPicker } from "./seller-picker";
import {
  createAssistedSellerAccount,
  searchLicenseRegistryForAssist,
  type LicenseSearchResult,
} from "@/lib/assisted-seller-signup";

const SEARCH_MODES = [
  { value: "number", label: "License #" },
  { value: "name", label: "Business name" },
  { value: "phone", label: "Phone" },
] as const;
type SearchMode = (typeof SEARCH_MODES)[number]["value"];

const inputClass =
  "w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm mt-1 bg-transparent";
const labelClass = "text-xs text-gray-500 dark:text-gray-400";

type SellerResult = {
  id: string;
  businessName: string | null;
  fullName: string;
  email: string;
  role: string;
  licenseVerification: string;
};

// Wraps the existing "search for an existing seller" picker with a second
// path for a grower/processor who hasn't signed up yet — a real gap an
// Account Executive hit while building a menu from a phone call, since the
// original SellerPicker can only find accounts that already exist. Mirrors
// the public signup form's license-number lookup/auto-approve logic
// (lib/assisted-seller-signup.ts) rather than a looser one, and swaps in a
// hidden `sellerId` the same way SellerPicker does, so ListingForm's
// surrounding <form> doesn't need to know which path was used.
export function SellerPickerOrCreate({
  searchAction,
}: {
  searchAction: (query: string) => Promise<SellerResult[]>;
}) {
  const [mode, setMode] = useState<"search" | "create">("search");
  const [created, setCreated] = useState<{ id: string; businessName: string } | null>(null);
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  const [searchMode, setSearchMode] = useState<SearchMode>("phone");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LicenseSearchResult[]>([]);
  const [searching, startSearchTransition] = useTransition();
  const [selected, setSelected] = useState<LicenseSearchResult | null>(null);

  function runSearch() {
    setResults([]);
    startSearchTransition(async () => {
      const r = await searchLicenseRegistryForAssist(query, searchMode);
      setResults(r);
    });
  }

  if (created) {
    return (
      <div>
        <input type="hidden" name="sellerId" value={created.id} />
        <p className="text-xs text-green-700 dark:text-green-400">
          Account created for {created.businessName} — posting under their identity.
        </p>
        <button
          type="button"
          onClick={() => {
            setCreated(null);
            setMode("search");
          }}
          className="text-[11px] text-gray-500 dark:text-gray-400 underline mt-1"
        >
          Use a different seller
        </button>
      </div>
    );
  }

  if (mode === "search") {
    return (
      <div>
        <SellerPicker searchAction={searchAction} />
        <button
          type="button"
          onClick={() => setMode("create")}
          className="text-[11px] text-green-700 dark:text-green-400 underline mt-1"
        >
          Grower/Processor doesn&apos;t have an account yet? Create one from their license number
        </button>
      </div>
    );
  }

  function submit() {
    if (!selected) return;
    setError(undefined);
    const formData = new FormData();
    formData.set("licenseNumber", selected.licenseNumber);
    formData.set("contactName", contactName);
    formData.set("email", email);
    formData.set("password", password);
    startTransition(async () => {
      const result = await createAssistedSellerAccount(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCreated({ id: result.sellerId, businessName: result.businessName });
    });
  }

  return (
    <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
          Create an account for a grower/processor who hasn&apos;t signed up
        </p>
        <button
          type="button"
          onClick={() => setMode("search")}
          className="text-[11px] text-gray-500 dark:text-gray-400 underline shrink-0"
        >
          Search existing instead
        </button>
      </div>

      {!selected ? (
        <div>
          <label className={labelClass}>Find them in Michigan&apos;s state registry</label>
          <div className="flex gap-1.5 mt-1">
            {SEARCH_MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setSearchMode(m.value)}
                className={`text-[11px] px-2 py-1 rounded-md border ${
                  searchMode === m.value
                    ? "bg-green-700 text-white border-green-700"
                    : "border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2 mt-1.5">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), runSearch())}
              placeholder={
                searchMode === "number" ? "e.g. AU-G-C-001819" : searchMode === "phone" ? "e.g. 248 953 9939" : "e.g. 123 Grow LLC"
              }
              className={inputClass + " mt-0"}
            />
            <button
              type="button"
              onClick={runSearch}
              disabled={searching || !query.trim()}
              className="shrink-0 bg-green-700 text-white rounded-lg px-3 py-2 text-xs font-medium disabled:opacity-50"
            >
              {searching ? "Searching…" : "Search"}
            </button>
          </div>
          <p className="text-[11px] text-gray-400 mt-1">
            Always searches the actual State of Michigan CRA registry — never a lead list&apos;s own
            numbering, which can differ from the state&apos;s.
          </p>
          {!searching && results.length === 0 && query.trim() && (
            <p className="text-xs text-gray-500 mt-2">No matches — try a different search, or a different field above.</p>
          )}
          {results.length > 0 && (
            <div className="mt-2 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
              {results.map((r) => (
                <button
                  key={r.licenseNumber}
                  type="button"
                  onClick={() => setSelected(r)}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-800 last:border-b-0"
                >
                  <span className="font-medium text-gray-900 dark:text-gray-100">{r.businessName}</span>{" "}
                  <span className="text-gray-400">
                    — {r.licenseNumber} · {r.city ?? "?"}, {r.state ?? "MI"} · {r.status}
                    {r.phone ? ` · ${r.phone}` : ""}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-900/20 p-2.5">
          <p className="text-xs text-green-800 dark:text-green-300">
            <span className="font-medium">{selected.businessName}</span> — {selected.licenseNumber}
          </p>
          <p className="text-[11px] text-green-700/80 dark:text-green-400/80">
            {selected.street ? `${selected.street}, ` : ""}
            {selected.city}, {selected.state} {selected.zip} · {selected.status}
          </p>
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="text-[11px] text-gray-500 dark:text-gray-400 underline mt-1"
          >
            Choose a different license
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass} htmlFor="assistedContactName">
            Contact name
          </label>
          <input
            id="assistedContactName"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="assistedEmail">
            Email
          </label>
          <input
            id="assistedEmail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>
      <div>
        <label className={labelClass} htmlFor="assistedPassword">
          Temporary password
        </label>
        <input
          id="assistedPassword"
          type="text"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
          className={inputClass}
        />
        <p className="text-[11px] text-gray-400 mt-1">
          Share this with them directly (phone/text) if they&apos;ll want to log in themselves later.
        </p>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={pending || !selected || !contactName.trim() || !email.trim() || password.length < 8}
        className="bg-green-700 text-white rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50"
      >
        {pending ? "Creating account…" : "Create account & continue"}
      </button>
    </div>
  );
}
