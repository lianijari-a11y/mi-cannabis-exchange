"use client";

import { useState, useTransition } from "react";
import { KeyRound } from "lucide-react";
import { resetSellerPasswordAction } from "@/app/sales/actions";

// Same reset-password action as ResetPasswordPanel, but for an account page
// that already knows exactly which seller it's looking at — no search step
// needed. "Grower forgot their password" is the whole reason this exists
// (CLAUDE.md §37) — putting it right on the account page they're already
// looking at is more direct than sending them back to the search panel.
export function InlineResetPassword({ sellerId, sellerLabel }: { sellerId: string; sellerLabel: string }) {
  const [open, setOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [result, setResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setResult(null);
    startTransition(async () => {
      const r = await resetSellerPasswordAction(sellerId, newPassword);
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
        <KeyRound className="w-3.5 h-3.5" /> Reset password
      </button>
    );
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      <input
        type="text"
        minLength={8}
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        placeholder="At least 8 characters"
        className="border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1 text-xs bg-transparent"
      />
      <button
        type="button"
        onClick={submit}
        disabled={pending || newPassword.length < 8}
        className="bg-green-700 text-white rounded-lg px-2.5 py-1 text-xs font-medium disabled:opacity-50"
      >
        {pending ? "Resetting…" : "Reset"}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-xs text-gray-400 underline">
        Cancel
      </button>
      {result?.error && <span className="text-xs text-red-600">{result.error}</span>}
      {result?.ok && (
        <span className="text-xs text-green-700 dark:text-green-400">
          Reset — relay it to {sellerLabel} directly.
        </span>
      )}
    </div>
  );
}
