"use client";

import { useState, useTransition } from "react";
import {
  searchRetailerLicenseRegistry,
  createRetailerAccountForAdmin,
  searchExistingRetailers,
  type CreateRetailerResult,
} from "@/lib/admin-retailer-assist";
import type { LicenseSearchResult } from "@/lib/assisted-seller-signup";

const inputClass =
  "w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm mt-1 bg-transparent";
const labelClass = "text-xs text-gray-500 dark:text-gray-400";

const SEARCH_MODES = [
  { value: "number", label: "License #" },
  { value: "name", label: "Business name" },
  { value: "phone", label: "Phone" },
] as const;

// Find-or-create the retailer account an Admin or Account Executive is
// acting on behalf of — originally built inline in components/listing/
// respond-panel.tsx for the single-listing "shared link" flow (CLAUDE.md
// §36/§49-C), extracted here unchanged so components/cart/cart-builder.tsx
// can reuse the exact same picker for the cart/menu checkout flow instead
// of a second, drifting copy.
export function RetailerPicker({ onResolved }: { onResolved: (r: { id: string; businessName: string }) => void }) {
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
