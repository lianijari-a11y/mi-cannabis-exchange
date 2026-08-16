import Link from "next/link";
import { Leaf } from "lucide-react";
import { SignupForm } from "./signup-form";

export default function SignupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4 py-10">
      <div className="w-full max-w-sm">
        <Link href="/" className="flex items-center justify-center gap-2 mb-6">
          <div className="w-9 h-9 bg-green-700 rounded-lg flex items-center justify-center">
            <Leaf className="w-4.5 h-4.5 text-white" />
          </div>
          <span className="font-semibold text-lg text-gray-900 dark:text-gray-100">
            MI Cannabis Exchange
          </span>
        </Link>

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 space-y-4">
          <div>
            <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Create your account
            </h1>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              Growers, processors, retailers, and transporters need a valid state license
              number. If it matches an active record in Michigan&apos;s license registry
              you&apos;re good to go immediately — otherwise an admin reviews it, but you can
              still post listings and make offers in the meantime.
            </p>
          </div>

          <SignupForm />

          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            Already have an account?{" "}
            <Link href="/login" className="text-green-700 font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
