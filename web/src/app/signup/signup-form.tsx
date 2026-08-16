"use client";

import { useActionState, useState } from "react";
import { signup } from "./actions";

const ROLE_OPTIONS = [
  { value: "grower", label: "Grower" },
  { value: "processor", label: "Processor" },
  { value: "retailer", label: "Retailer" },
  { value: "broker", label: "Broker" },
  { value: "transporter", label: "Transporter" },
] as const;

const LICENSED_ROLES = new Set(["grower", "processor", "retailer", "transporter"]);
const ADDRESS_ROLES = new Set(["grower", "processor", "retailer"]);

const inputClass =
  "w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm mt-1 bg-transparent";
const labelClass = "text-xs text-gray-500 dark:text-gray-400";

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signup, undefined);
  const [role, setRole] = useState<string>("grower");
  const licensed = LICENSED_ROLES.has(role);
  const needsAddress = ADDRESS_ROLES.has(role);

  return (
    <form action={formAction} className="space-y-3">
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

      <div>
        <label className={labelClass} htmlFor="businessName">
          Business name
        </label>
        <input id="businessName" name="businessName" className={inputClass} />
      </div>

      {licensed && (
        <>
          <div>
            <label className={labelClass} htmlFor="licenseNumber">
              State license number
            </label>
            <input id="licenseNumber" name="licenseNumber" required className={inputClass} />
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

      {needsAddress && (
        <>
          <div>
            <label className={labelClass} htmlFor="address">
              Pickup / delivery address
            </label>
            <input id="address" name="address" required className={inputClass} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <label className={labelClass} htmlFor="city">
                City
              </label>
              <input id="city" name="city" required className={inputClass} />
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
              <input id="zip" name="zip" required className={inputClass} />
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
