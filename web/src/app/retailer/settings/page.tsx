import { requireRole } from "@/lib/dal";
import { PortalShell } from "@/components/portal-shell";
import { MetrcSettings } from "@/components/metrc-settings";
import { prisma } from "@/lib/prisma";
import {
  connectMetrcAction,
  disconnectMetrcAction,
  setDefaultMarkupAction,
  setStorefrontSlugAction,
  setLoyaltySettingsAction,
  setDailyPurchaseLimitAction,
} from "./actions";

const NAV = [
  { href: "/retailer", label: "Browse inventory" },
  { href: "/retailer/negotiations", label: "My negotiations" },
  { href: "/retailer/watchlist", label: "Watchlist" },
  { href: "/retailer/requests", label: "Wanted board" },
  { href: "/retailer/pos", label: "Point of sale" },
  { href: "/retailer/settings", label: "Settings" },
];

export default async function RetailerSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireRole("retailer");
  const { error } = await searchParams;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      defaultMarkupPercent: true,
      storefrontSlug: true,
      loyaltyPointsPerDollar: true,
      dailyPurchaseLimitOz: true,
    },
  });

  return (
    <PortalShell roleLabel="Retailer" navItems={NAV}>
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Settings</h1>
      {error && (
        <p className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 rounded-lg p-2 mb-4 max-w-md">
          {error}
        </p>
      )}
      <div className="space-y-4">
        <MetrcSettings userId={session.user.id} connectAction={connectMetrcAction} disconnectAction={disconnectMetrcAction} />

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 space-y-3 max-w-md">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Online ordering
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Set a link for your public order-ahead menu — customers browse what&apos;s in your POS
            inventory, place a pickup order, and pay when they arrive. No accounts, no online
            payment — see CLAUDE.md §25.
          </p>
          <form action={setStorefrontSlugAction} className="flex items-center gap-2">
            <span className="text-xs text-gray-400">/order/</span>
            <input
              name="storefrontSlug"
              defaultValue={user?.storefrontSlug ?? ""}
              placeholder="your-store-name"
              className="flex-1 border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1.5 text-xs bg-transparent"
            />
            <button type="submit" className="bg-green-700 text-white rounded-lg px-3 py-1.5 text-xs font-medium">
              Save
            </button>
          </form>
          {user?.storefrontSlug && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Your menu is live at{" "}
              <a href={`/order/${user.storefrontSlug}`} target="_blank" className="text-green-700 dark:text-green-400 underline">
                /order/{user.storefrontSlug}
              </a>
            </p>
          )}
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 space-y-3 max-w-md">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Point of sale defaults
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Prefills the markup when you add a delivered deal to POS inventory — still editable
            per item.
          </p>
          <form action={setDefaultMarkupAction} className="flex items-center gap-2">
            <input
              name="defaultMarkupPercent"
              type="number"
              step="0.1"
              min="0"
              defaultValue={user?.defaultMarkupPercent ?? ""}
              placeholder="e.g. 50"
              className="w-24 border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1.5 text-xs bg-transparent"
            />
            <span className="text-xs text-gray-400">%</span>
            <button type="submit" className="bg-green-700 text-white rounded-lg px-3 py-1.5 text-xs font-medium">
              Save
            </button>
          </form>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 space-y-3 max-w-md">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Register customer panel
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Both are plain editable numbers, not certified figures — same posture as everything
            else priced or limited in this app.
          </p>
          <form action={setLoyaltySettingsAction} className="flex items-center gap-2">
            <label className="text-xs text-gray-500 dark:text-gray-400 w-40 shrink-0">
              Loyalty points per $1 spent
            </label>
            <input
              name="loyaltyPointsPerDollar"
              type="number"
              step="0.1"
              min="0"
              defaultValue={user?.loyaltyPointsPerDollar ?? ""}
              placeholder="e.g. 1 (blank = off)"
              className="w-32 border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1.5 text-xs bg-transparent"
            />
            <button type="submit" className="bg-green-700 text-white rounded-lg px-3 py-1.5 text-xs font-medium">
              Save
            </button>
          </form>
          <form action={setDailyPurchaseLimitAction} className="flex items-center gap-2">
            <label className="text-xs text-gray-500 dark:text-gray-400 w-40 shrink-0">
              Daily flower purchase limit
            </label>
            <input
              name="dailyPurchaseLimitOz"
              type="number"
              step="0.1"
              min="0.1"
              defaultValue={user?.dailyPurchaseLimitOz ?? ""}
              placeholder="e.g. 2.5 (blank = off)"
              className="w-32 border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1.5 text-xs bg-transparent"
            />
            <span className="text-xs text-gray-400">oz</span>
            <button type="submit" className="bg-green-700 text-white rounded-lg px-3 py-1.5 text-xs font-medium">
              Save
            </button>
          </form>
          <p className="text-xs text-gray-400">
            The purchase-limit bar only tracks flower/pre-roll sold by weight, and only once a
            customer is attached to the sale — it isn&apos;t a certified compliance check.
          </p>
        </div>
      </div>
    </PortalShell>
  );
}
