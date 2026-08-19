"use client";

import { useState, useTransition } from "react";
import { KeyRound } from "lucide-react";
import { searchSellersAction } from "@/app/sales/search-action";
import { resetSellerPasswordAction } from "@/app/sales/actions";

type Seller = {
  id: string;
  businessName: string | null;
  fullName: string;
  email: string;
  role: string;
};

// A grower/processor calls their Account Executive when they're locked out
// — there's no self-serve "forgot password" flow anywhere in this app (see
// lib/account-management.ts). Reuses the same seller search already built
// for the "post for a seller" flow, so an AE doesn't need a second lookup
// UI to find the right account.
export function ResetPasswordPanel() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Seller[]>([]);
  const [selected, setSelected] = useState<Seller | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [result, setResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function search() {
    startTransition(async () => setResults(await searchSellersAction(query)));
  }

  function submit() {
    if (!selected) return;
    setResult(null);
    startTransition(async () => {
      const r = await resetSellerPasswordAction(selected.id, newPassword);
      setResult(r.ok ? { ok: true } : { ok: false, error: r.error });
      if (r.ok) setNewPassword("");
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400 border border-green-200 dark:border-green-900 rounded-full px-2.5 py-1"
      >
        <KeyRound className="w-3.5 h-3.5" /> Reset a seller&apos;s password
      </button>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 max-w-md">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
          Reset a grower or processor&apos;s password
        </h3>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-gray-400 underline">
          Close
        </button>
      </div>

      {!selected ? (
        <>
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Business name or email"
              className="flex-1 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-transparent"
            />
            <button
              type="button"
              onClick={search}
              disabled={pending || !query.trim()}
              className="shrink-0 bg-green-700 text-white rounded-lg px-3 py-2 text-xs font-medium disabled:opacity-50"
            >
              Search
            </button>
          </div>
          {results.length > 0 && (
            <div className="mt-2 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
              {results.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelected(s)}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-800 last:border-b-0"
                >
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {s.businessName ?? s.fullName}
                  </span>{" "}
                  <span className="text-gray-400">
                    — {s.role} · {s.email}
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="space-y-3">
          <div className="rounded-lg border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-900/20 p-2.5">
            <p className="text-xs text-green-800 dark:text-green-300">
              <span className="font-medium">{selected.businessName ?? selected.fullName}</span> —{" "}
              {selected.email}
            </p>
            <button
              type="button"
              onClick={() => {
                setSelected(null);
                setResult(null);
              }}
              className="text-[11px] text-gray-500 dark:text-gray-400 underline mt-1"
            >
              Choose a different seller
            </button>
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400">New password</label>
            <input
              type="text"
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm mt-1 bg-transparent"
            />
          </div>
          {result?.error && <p className="text-xs text-red-600">{result.error}</p>}
          {result?.ok && (
            <p className="text-xs text-green-700 dark:text-green-400">
              Password reset — relay it to {selected.businessName ?? selected.fullName} directly.
            </p>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={pending || newPassword.length < 8}
            className="bg-green-700 text-white rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50"
          >
            {pending ? "Resetting…" : "Reset password"}
          </button>
        </div>
      )}
    </div>
  );
}
