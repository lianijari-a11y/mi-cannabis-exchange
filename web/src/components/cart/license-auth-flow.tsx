"use client";

import { useState } from "react";
import {
  checkRetailerLicense,
  signInWithLicense,
  setNewPasswordForLicense,
  type LicenseCheckResult,
} from "@/lib/cart-auth";

type Step = "license" | "password" | "create";

// The human's own spec, followed in order: the retailer clicks
// Accept/Counter first (this panel only ever opens because they already
// did — see cart-builder.tsx), THEN gets asked for a license number, THEN
// a password — an existing one if the account's already real, a brand-new
// one if there's no account yet, or a forced new one if an Admin/AE set
// the current password on their behalf and they've never actually chosen
// their own (User.mustChangePassword). Once authenticated, the parent
// resumes whichever action was originally clicked — this panel's only job
// is getting a real retailer session in place.
export function LicenseAuthFlow({ onAuthenticated, onCancel }: { onAuthenticated: () => void; onCancel: () => void }) {
  const [step, setStep] = useState<Step>("license");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [checkResult, setCheckResult] = useState<LicenseCheckResult | null>(null);
  const [password, setPassword] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitLicense(e: React.FormEvent) {
    e.preventDefault();
    if (!licenseNumber.trim()) return;
    setError(null);
    setPending(true);
    const result = await checkRetailerLicense(licenseNumber);
    setPending(false);
    setCheckResult(result);
    if (result.status === "rate_limited") {
      setError("Too many attempts — try again in a minute.");
      return;
    }
    if (result.status === "not_found") {
      setError("No retailer license found for that number — double-check it, or contact the seller.");
      return;
    }
    if (result.status === "existing" && !result.mustChangePassword) {
      setStep("password");
    } else {
      // Either a brand-new account, or an existing one whose password an
      // Admin/AE set and needs replacing — both land on the same "choose
      // a password" step, just with different fields shown below.
      setStep("create");
    }
  }

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const result = await signInWithLicense(licenseNumber, password);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onAuthenticated();
  }

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const result = await setNewPasswordForLicense(licenseNumber, password, { contactName, email });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onAuthenticated();
  }

  const isNewAccount = checkResult?.status === "new";

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
      {step === "license" && (
        <form onSubmit={submitLicense} className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400" htmlFor="cart-auth-license">
              Your state retailer license number
            </label>
            <input
              id="cart-auth-license"
              value={licenseNumber}
              onChange={(e) => setLicenseNumber(e.target.value)}
              autoFocus
              className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm mt-1 bg-transparent"
              placeholder="e.g. AU-R-000000"
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending || !licenseNumber.trim()}
              className="flex-1 bg-green-700 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {pending ? "Checking…" : "Continue"}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-lg px-4 py-2 text-sm font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {step === "password" && (
        <form onSubmit={submitPassword} className="space-y-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            License {licenseNumber} — enter your password to continue.
          </p>
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400" htmlFor="cart-auth-password">
              Password
            </label>
            <input
              id="cart-auth-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm mt-1 bg-transparent"
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending || !password}
              className="flex-1 bg-green-700 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {pending ? "Signing in…" : "Sign in and continue"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("license");
                setError(null);
              }}
              className="border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-lg px-4 py-2 text-sm font-medium"
            >
              Back
            </button>
          </div>
        </form>
      )}

      {step === "create" && (
        <form onSubmit={submitCreate} className="space-y-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {isNewAccount
              ? `We found "${checkResult && "businessName" in checkResult ? checkResult.businessName : ""}" for license ${licenseNumber} — set a password to finish creating your account.`
              : `Your account's temporary password needs to be replaced — choose your own password to continue.`}
          </p>
          {isNewAccount && (
            <>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400" htmlFor="cart-auth-name">
                  Contact name
                </label>
                <input
                  id="cart-auth-name"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm mt-1 bg-transparent"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400" htmlFor="cart-auth-email">
                  Email
                </label>
                <input
                  id="cart-auth-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm mt-1 bg-transparent"
                />
              </div>
            </>
          )}
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400" htmlFor="cart-auth-newpassword">
              New password
            </label>
            <input
              id="cart-auth-newpassword"
              type="password"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm mt-1 bg-transparent"
              placeholder="At least 8 characters"
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending || password.length < 8 || (isNewAccount && (!contactName || !email))}
              className="flex-1 bg-green-700 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {pending ? "Saving…" : "Set password and continue"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("license");
                setError(null);
              }}
              className="border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-lg px-4 py-2 text-sm font-medium"
            >
              Back
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
