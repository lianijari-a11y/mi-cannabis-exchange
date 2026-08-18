"use client";

import { useState, useTransition } from "react";
import { SellerPicker } from "./seller-picker";
import { createAssistedSellerAccount } from "@/lib/assisted-seller-signup";

const inputClass =
  "w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm mt-1 bg-transparent";
const labelClass = "text-xs text-gray-500 dark:text-gray-400";

type SellerResult = {
  id: string;
  businessName: string | null;
  fullName: string;
  email: string;
  role: string;
  licenseVerification: string;
};

// Wraps the existing "search for an existing seller" picker with a second
// path for a grower/processor who hasn't signed up yet — a real gap an
// Account Executive hit while building a menu from a phone call, since the
// original SellerPicker can only find accounts that already exist. Mirrors
// the public signup form's license-number lookup/auto-approve logic
// (lib/assisted-seller-signup.ts) rather than a looser one, and swaps in a
// hidden `sellerId` the same way SellerPicker does, so ListingForm's
// surrounding <form> doesn't need to know which path was used.
export function SellerPickerOrCreate({
  searchAction,
}: {
  searchAction: (query: string) => Promise<SellerResult[]>;
}) {
  const [mode, setMode] = useState<"search" | "create">("search");
  const [created, setCreated] = useState<{ id: string; businessName: string } | null>(null);
  const [licenseNumber, setLicenseNumber] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  if (created) {
    return (
      <div>
        <input type="hidden" name="sellerId" value={created.id} />
        <p className="text-xs text-green-700 dark:text-green-400">
          Account created for {created.businessName} — posting under their identity.
        </p>
        <button
          type="button"
          onClick={() => {
            setCreated(null);
            setMode("search");
          }}
          className="text-[11px] text-gray-500 dark:text-gray-400 underline mt-1"
        >
          Use a different seller
        </button>
      </div>
    );
  }

  if (mode === "search") {
    return (
      <div>
        <SellerPicker searchAction={searchAction} />
        <button
          type="button"
          onClick={() => setMode("create")}
          className="text-[11px] text-green-700 dark:text-green-400 underline mt-1"
        >
          Grower/Processor doesn&apos;t have an account yet? Create one from their license number
        </button>
      </div>
    );
  }

  function submit() {
    setError(undefined);
    const formData = new FormData();
    formData.set("licenseNumber", licenseNumber);
    formData.set("contactName", contactName);
    formData.set("email", email);
    formData.set("password", password);
    startTransition(async () => {
      const result = await createAssistedSellerAccount(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCreated({ id: result.sellerId, businessName: result.businessName });
    });
  }

  return (
    <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
          Create an account for a grower/processor who hasn&apos;t signed up
        </p>
        <button
          type="button"
          onClick={() => setMode("search")}
          className="text-[11px] text-gray-500 dark:text-gray-400 underline shrink-0"
        >
          Search existing instead
        </button>
      </div>
      <div>
        <label className={labelClass} htmlFor="assistedLicenseNumber">
          State license number
        </label>
        <input
          id="assistedLicenseNumber"
          value={licenseNumber}
          onChange={(e) => setLicenseNumber(e.target.value)}
          placeholder="e.g. GC-000123"
          className={inputClass}
        />
        <p className="text-[11px] text-gray-400 mt-1">
          Checked against Michigan&apos;s Grower and Processor license registry — business name and
          address auto-fill from there.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass} htmlFor="assistedContactName">
            Contact name
          </label>
          <input
            id="assistedContactName"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="assistedEmail">
            Email
          </label>
          <input
            id="assistedEmail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>
      <div>
        <label className={labelClass} htmlFor="assistedPassword">
          Temporary password
        </label>
        <input
          id="assistedPassword"
          type="text"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
          className={inputClass}
        />
        <p className="text-[11px] text-gray-400 mt-1">
          Share this with them directly (phone/text) if they&apos;ll want to log in themselves later.
        </p>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={pending || !licenseNumber.trim() || !contactName.trim() || !email.trim() || password.length < 8}
        className="bg-green-700 text-white rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50"
      >
        {pending ? "Looking up license…" : "Create account & continue"}
      </button>
    </div>
  );
}
