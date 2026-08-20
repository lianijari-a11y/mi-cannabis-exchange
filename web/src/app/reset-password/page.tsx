import Link from "next/link";
import { validateResetToken } from "@/lib/password-reset";
import { ResetPasswordForm } from "./reset-password-form";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const check = token ? await validateResetToken(token) : { ok: false as const, error: "Missing reset token." };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="flex items-center justify-center gap-2 mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logos/cannabliz-icon.png" alt="Cannabliz" className="w-9 h-9 rounded-lg object-cover" />
          <span className="font-semibold text-lg text-gray-900 dark:text-gray-100">Cannabliz</span>
        </Link>

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 space-y-4">
          <div>
            <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100">Set a new password</h1>
          </div>

          {check.ok ? (
            <ResetPasswordForm token={token!} />
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-red-600">{check.error}</p>
              <Link
                href="/forgot-password"
                className="text-xs text-green-700 dark:text-green-400 font-medium block text-center"
              >
                Request a new reset link
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
