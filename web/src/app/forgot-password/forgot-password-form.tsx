"use client";

import { useActionState } from "react";
import { requestPasswordResetAction } from "./actions";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, undefined);

  if (state?.ok) {
    return (
      <p className="text-sm text-gray-700 dark:text-gray-300">
        If that email matches an account, a reset link is on its way — check your inbox (and spam
        folder). The link expires in 1 hour.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label className="text-xs text-gray-500 dark:text-gray-400" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm mt-1 bg-transparent"
        />
      </div>
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full bg-green-700 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}
