import Link from "next/link";
import { ForgotPasswordForm } from "./forgot-password-form";

export default function ForgotPasswordPage() {
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
            <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100">Reset your password</h1>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              Enter your account email and we&apos;ll send you a reset link.
            </p>
          </div>

          <ForgotPasswordForm />

          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            <Link href="/login" className="text-green-700 dark:text-green-400 font-medium">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
