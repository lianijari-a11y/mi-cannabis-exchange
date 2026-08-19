"use client";

import { useActionState, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { signup } from "./actions";

// Broker and Sales Rep are intentionally not offered here — see the
// matching comment on SIGNUP_ROLES in ./actions.ts.
const ROLE_OPTIONS = [
  { value: "grower", label: "Grower" },
  { value: "processor", label: "Processor" },
  { value: "retailer", label: "Retailer" },
  { value: "transporter", label: "Transporter" },
] as const;

const LICENSED_ROLES = new Set(["grower", "processor", "retailer", "transporter"]);
const ADDRESS_ROLES = new Set(["grower", "processor", "retailer"]);

const inputClass =
  "w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm mt-1 bg-transparent";
const labelClass = "text-xs text-gray-500 dark:text-gray-400";

type LicenseLookupResult = {
  found: boolean;
  businessName?: string;
  street?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  status?: string;
  isActive?: boolean;
};

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signup, undefined);
  const searchParams = useSearchParams();
  // A shared listing link (CLAUDE.md §36) sends a would-be Retailer here
  // with ?role=retailer&callbackUrl=/listing/[id]/respond?... so they land
  // pre-selected on the right account type and return to finish the action
  // they clicked, instead of the generic Retailer dashboard.
  const requestedRole = searchParams.get("role");
  const callbackUrl = searchParams.get("callbackUrl");
  const [role, setRole] = useState<string>(
    ROLE_OPTIONS.some((o) => o.value === requestedRole) ? requestedRole! : "grower"
  );
  const licensed = LICENSED_ROLES.has(role);
  const needsAddress = ADDRESS_ROLES.has(role);

  const [businessName, setBusinessName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [zip, setZip] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [lookup, setLookup] = useState<LicenseLookupResult | null>(null);
  const [lookupPending, setLookupPending] = useState(false);

  // Debounced as-you-type lookup rather than onBlur-only — onBlur only
  // fires once the field loses focus, which a user can easily skip (hitting
  // Enter to submit, tabbing through a password manager, etc.), silently
  // leaving business name/address unfilled with no obvious cause. Firing
  // off a short pause in typing instead means it works no matter how the
  // user gets from this field to the next.
  useEffect(() => {
    const trimmed = licenseNumber.trim();
    if (!trimmed) {
      setLookup(null);
      return;
    }
    setLookupPending(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/license-lookup?licenseNumber=${encodeURIComponent(trimmed)}&role=${encodeURIComponent(role)}`
        );
        const result: LicenseLookupResult = await res.json();
        setLookup(result);
        if (result.found) {
          if (!businessName) setBusinessName(result.businessName ?? "");
          if (!address) setAddress(result.street ?? "");
          if (!city) setCity(result.city ?? "");
          if (!zip) setZip(result.zip ?? "");
        }
      } catch {
        setLookup(null);
      } finally {
        setLookupPending(false);
      }
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [licenseNumber, role]);

  return (
    <form action={formAction} className="space-y-3">
      {callbackUrl && <input type="hidden" name="callbackUrl" value={callbackUrl} />}
      <div>
        <label className={labelClass} htmlFor="role">
          Account type
        </label>
        <select
          id="role"
          name="role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className={inputClass}
        >
          {ROLE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass} htmlFor="fullName">
          Full name
        </label>
        <input id="fullName" name="fullName" required className={inputClass} />
      </div>

      {licensed && (
        <>
          <div>
            <label className={labelClass} htmlFor="licenseNumber">
              State license number
            </label>
            <input
              id="licenseNumber"
              name="licenseNumber"
              required
              className={inputClass}
              value={licenseNumber}
              onChange={(e) => setLicenseNumber(e.target.value)}
              placeholder="e.g. AU-G-C-001830"
            />
            {lookupPending && (
              <p className="text-xs text-gray-400 mt-1">Checking state registry…</p>
            )}
            {!lookupPending && lookup?.found && lookup.isActive && (
              <p className="text-xs text-green-700 mt-1">
                ✓ Found in the state registry ({lookup.status}) — business name and address filled
                in below, and your account won&apos;t need to wait on Admin review.
              </p>
            )}
            {!lookupPending && lookup?.found && !lookup.isActive && (
              <p className="text-xs text-amber-600 mt-1">
                Found in the state registry, but its status is &ldquo;{lookup.status}&rdquo; — an
                Admin will need to review this one manually.
              </p>
            )}
            {!lookupPending && lookup && !lookup.found && (
              <p className="text-xs text-gray-400 mt-1">
                Not found in the state registry — that&apos;s fine, an Admin will review it. You
                can still post and make offers while that&apos;s pending.
              </p>
            )}
          </div>
          <div>
            <label className={labelClass} htmlFor="licenseType">
              License type
            </label>
            <input
              id="licenseType"
              name="licenseType"
              placeholder={
                role === "transporter"
                  ? "Secure Transporter"
                  : "e.g. Class C Grower, Processor, Retailer"
              }
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="licenseExpiry">
              License expiration date (optional)
            </label>
            <input id="licenseExpiry" name="licenseExpiry" type="date" className={inputClass} />
          </div>
        </>
      )}

      <div>
        <label className={labelClass} htmlFor="businessName">
          Business name
        </label>
        <input
          id="businessName"
          name="businessName"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass} htmlFor="phone">
          Phone (optional)
        </label>
        <input id="phone" name="phone" type="tel" className={inputClass} />
      </div>

      {needsAddress && (
        <>
          <div>
            <label className={labelClass} htmlFor="address">
              Pickup / delivery address
            </label>
            <input
              id="address"
              name="address"
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <label className={labelClass} htmlFor="city">
                City
              </label>
              <input
                id="city"
                name="city"
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="state">
                State
              </label>
              <input id="state" name="state" required defaultValue="MI" className={inputClass} />
            </div>
            <div>
              <label className={labelClass} htmlFor="zip">
                ZIP
              </label>
              <input
                id="zip"
                name="zip"
                required
                value={zip}
                onChange={(e) => setZip(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
        </>
      )}

      <div>
        <label className={labelClass} htmlFor="email">
          Email
        </label>
        <input id="email" name="email" type="email" required className={inputClass} />
      </div>

      <div>
        <label className={labelClass} htmlFor="password">
          Password
        </label>
        <input id="password" name="password" type="password" required minLength={8} className={inputClass} />
      </div>

      <div>
        <label className={labelClass} htmlFor="confirmPassword">
          Confirm password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          className={inputClass}
        />
      </div>

      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-green-700 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50"
      >
        {pending ? "Creating account..." : "Create account"}
      </button>
    </form>
  );
}
