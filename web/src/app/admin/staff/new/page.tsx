import { requireRole } from "@/lib/dal";
import { PortalShell } from "@/components/portal-shell";
import { createStaff } from "./actions";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/listings", label: "All listings" },
  { href: "/admin/accounts", label: "Accounts" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/listings/new", label: "Post for a seller" },
  { href: "/admin/staff/new", label: "Add staff account" },
  { href: "/admin/sales-reps", label: "Account Executive earnings" },
  { href: "/admin/data-uploads", label: "Data uploads" },
  { href: "/admin/metrc", label: "METRC" },
  { href: "/admin/system-health", label: "System health" },
  { href: "/admin/marketing", label: "Marketing suite" },
];

export default async function NewStaffAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireRole("admin");
  const { error } = await searchParams;

  return (
    <PortalShell roleLabel="Admin" navItems={NAV}>
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
        Add a staff account
      </h1>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 max-w-md">
        Broker and Account Executive accounts see every real negotiation and the whole lead CRM the
        moment they log in — no license review, because there&apos;s no license to check. That
        level of access is only handed out here, by an Admin, not through public signup.
      </p>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 rounded-lg p-2 mb-4 max-w-md">
          {error}
        </p>
      )}

      <form action={createStaff} className="space-y-3 max-w-md">
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400" htmlFor="role">
            Account type
          </label>
          <select
            id="role"
            name="role"
            required
            defaultValue="broker"
            className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm mt-1 bg-transparent"
          >
            <option value="broker">Broker</option>
            <option value="sales_rep">Account Executive</option>
          </select>
        </div>

        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400" htmlFor="fullName">
            Full name
          </label>
          <input
            id="fullName"
            name="fullName"
            required
            className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm mt-1 bg-transparent"
          />
        </div>

        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400" htmlFor="businessName">
            Business name (optional)
          </label>
          <input
            id="businessName"
            name="businessName"
            className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm mt-1 bg-transparent"
          />
        </div>

        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm mt-1 bg-transparent"
          />
        </div>

        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400" htmlFor="phone">
            Phone (optional)
          </label>
          <input
            id="phone"
            name="phone"
            className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm mt-1 bg-transparent"
          />
        </div>

        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400" htmlFor="password">
            Temporary password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm mt-1 bg-transparent"
          />
        </div>

        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400" htmlFor="confirmPassword">
            Confirm password
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            required
            minLength={8}
            className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm mt-1 bg-transparent"
          />
        </div>

        <button
          type="submit"
          className="bg-green-700 text-white rounded-lg px-4 py-2 text-sm font-medium"
        >
          Create account
        </button>
      </form>
    </PortalShell>
  );
}
