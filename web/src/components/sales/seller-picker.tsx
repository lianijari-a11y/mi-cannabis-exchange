"use client";

import { useState, useTransition } from "react";

type SellerResult = {
  id: string;
  businessName: string | null;
  fullName: string;
  email: string;
  role: string;
  licenseVerification: string;
};

// Search-and-select for the Sales Rep / Admin "post on behalf of a seller"
// forms — real business names shown on purpose (this is internal staff
// building a listing for a specific licensed account, not a retailer-facing
// view), sets a hidden `sellerId` input the surrounding <form> submits.
export function SellerPicker({
  searchAction,
}: {
  searchAction: (query: string) => Promise<SellerResult[]>;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SellerResult[]>([]);
  const [selected, setSelected] = useState<SellerResult | null>(null);
  const [pending, startTransition] = useTransition();

  function search(q: string) {
    setQuery(q);
    setSelected(null);
    if (!q.trim()) {
      setResults([]);
      return;
    }
    startTransition(async () => {
      setResults(await searchAction(q));
    });
  }

  return (
    <div>
      <label className="text-xs text-gray-500 dark:text-gray-400">
        Post this listing on behalf of
      </label>
      <input type="hidden" name="sellerId" value={selected?.id ?? ""} />
      <input
        type="text"
        placeholder="Search by business name or email…"
        value={selected ? (selected.businessName ?? selected.fullName) : query}
        onChange={(e) => search(e.target.value)}
        className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm mt-1 bg-transparent"
      />
      {pending && <p className="text-xs text-gray-400 mt-1">Searching…</p>}
      {!selected && results.length > 0 && (
        <div className="mt-1 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => {
                setSelected(r);
                setResults([]);
              }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-800 last:border-b-0"
            >
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {r.businessName ?? r.fullName}
              </span>{" "}
              <span className="text-gray-400">
                — {r.role} · {r.email}
                {r.licenseVerification !== "approved" ? ` · license: ${r.licenseVerification}` : ""}
              </span>
            </button>
          ))}
        </div>
      )}
      {selected && (
        <p className="text-xs text-green-700 dark:text-green-400 mt-1">
          Posting for {selected.businessName ?? selected.fullName} ({selected.role})
        </p>
      )}
    </div>
  );
}
