"use client";

import { useActionState, useEffect, useRef } from "react";
import { changeOwnPasswordAction } from "@/lib/account-actions";

// The self-service "change my own password" control — reusable across
// every role's settings page. Before this shipped, the only way anyone's
// password ever changed was an Admin/AE resetting it for them, or a
// retailer going through the public cart link's license-first flow.
export function ChangePasswordPanel() {
  const [state, formAction, pending] = useActionState(changeOwnPasswordAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Change password</h2>
      <form ref={formRef} action={formAction} className="space-y-3 max-w-sm">
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400" htmlFor="currentPassword">
            Current password
          </label>
          <input
            id="currentPassword"
            name="currentPassword"
            type="password"
            required
            autoComplete="current-password"
            className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm mt-1 bg-transparent"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400" htmlFor="newPassword">
            New password
          </label>
          <input
            id="newPassword"
            name="newPassword"
            type="password"
            required
            minLength={8}
            placeholder="At least 8 characters"
            autoComplete="new-password"
            className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm mt-1 bg-transparent"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400" htmlFor="confirmPassword">
            Confirm new password
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm mt-1 bg-transparent"
          />
        </div>
        {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
        {state?.ok && <p className="text-xs text-green-700 dark:text-green-400">Password updated.</p>}
        <button
          type="submit"
          disabled={pending}
          className="bg-green-700 text-white rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50"
        >
          {pending ? "Updating…" : "Update password"}
        </button>
      </form>
    </div>
  );
}
