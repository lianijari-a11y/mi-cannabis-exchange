import { Leaf } from "lucide-react";
import { requireAuth } from "@/lib/dal";
import { hasAcceptedNonCircumvent, NON_CIRCUMVENT_TEXT } from "@/lib/agreements";
import { roleHome } from "@/lib/constants";
import { redirect } from "next/navigation";
import { logout } from "@/app/actions";
import { acceptAgreement } from "./actions";

export default async function NonCircumventPage() {
  const session = await requireAuth();

  // Already accepted (e.g. they hit back after accepting) — just move on.
  if (await hasAcceptedNonCircumvent(session.user.id)) {
    redirect(roleHome(session.user.role));
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4 py-10">
      <div className="max-w-lg w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 bg-green-700 rounded-lg flex items-center justify-center">
            <Leaf className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">
            MI Cannabis Exchange
          </span>
        </div>

        <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">
          Non-circumvention agreement
        </h1>
        <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900 rounded-lg p-2 mb-3">
          Draft text, not yet reviewed by an attorney — see the note at the bottom.
        </p>

        <div className="text-xs text-gray-600 dark:text-gray-300 whitespace-pre-line max-h-64 overflow-y-auto border border-gray-100 dark:border-gray-800 rounded-lg p-3 mb-4">
          {NON_CIRCUMVENT_TEXT}
        </div>

        <div className="flex items-center gap-3">
          <form action={acceptAgreement}>
            <button
              type="submit"
              className="bg-green-700 text-white rounded-lg px-4 py-2 text-sm font-medium"
            >
              I agree — continue
            </button>
          </form>
          <form action={logout}>
            <button type="submit" className="text-xs text-gray-500 dark:text-gray-400 underline">
              Sign out instead
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
