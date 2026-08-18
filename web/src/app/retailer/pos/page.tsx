import type { Metadata } from "next";
import { requireRole } from "@/lib/dal";
import { PortalShell } from "@/components/portal-shell";
import { prisma } from "@/lib/prisma";
import {
  availableDealsForIntake,
  activeInventoryForRetailer,
  salesHistoryForRetailer,
  pendingOrdersForRetailer,
} from "@/lib/pos";
import { metrcConnectionFor } from "@/lib/metrc-integration";
import { smsConnectionFor, optedInCustomerCount, messageHistoryForRetailer } from "@/lib/marketing-sms";
import { RegisterPanel } from "@/components/retailer/pos/register-panel";
import { IntakePanel } from "@/components/retailer/pos/intake-panel";
import { InventoryPanel } from "@/components/retailer/pos/inventory-panel";
import { SalesHistoryPanel } from "@/components/retailer/pos/sales-history-panel";
import { OrdersPanel } from "@/components/retailer/pos/orders-panel";
import { MarketingPanel } from "@/components/retailer/pos/marketing-panel";
import { PosTabs } from "@/components/retailer/pos/pos-tabs";
import { LiveRefresh } from "@/components/retailer/pos/live-refresh";

// iOS's "Add to Home Screen" captures whatever page is open at the moment,
// not one global manifest — so a retailer who adds THIS page to their
// iPad's home screen gets a distinct "Xcelerate POS" icon/title, separate
// from adding Cannabliz from the root/login page. No second PWA needed.
// See CLAUDE.md §28 — icon is still the Zap placeholder pending the real
// logo file.
export const metadata: Metadata = {
  // { absolute: ... } opts out of the root layout's "%s · Cannabliz" title
  // template — this page should read as its own product, not a subpage.
  title: { absolute: "Xcelerate POS" },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Xcelerate POS",
  },
  icons: {
    icon: [{ url: "/favicon-xcelerate-32.png", sizes: "32x32", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon-xcelerate.png", sizes: "180x180", type: "image/png" }],
  },
};

const NAV = [
  { href: "/retailer", label: "Browse inventory" },
  { href: "/retailer/negotiations", label: "My negotiations" },
  { href: "/retailer/watchlist", label: "Watchlist" },
  { href: "/retailer/requests", label: "Wanted board" },
  { href: "/retailer/pos", label: "Point of sale" },
  { href: "/retailer/settings", label: "Settings" },
];

export default async function RetailerPosPage() {
  const session = await requireRole("retailer");
  const [deals, lots, sales, orders, user, metrcConnection, smsConnection, optedInCount, marketingMessages] =
    await Promise.all([
      availableDealsForIntake(session.user.id),
      activeInventoryForRetailer(session.user.id),
      salesHistoryForRetailer(session.user.id),
      pendingOrdersForRetailer(session.user.id),
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { defaultMarkupPercent: true, dailyPurchaseLimitOz: true },
      }),
      metrcConnectionFor(session.user.id),
      smsConnectionFor(session.user.id),
      optedInCustomerCount(session.user.id),
      messageHistoryForRetailer(session.user.id),
    ]);

  return (
    <PortalShell roleLabel="Retailer" navItems={NAV} brand="xcelerate">
      <LiveRefresh />
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Point of sale</h1>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Sell delivered wholesale inventory to consumers in your store.
        </p>
        {!metrcConnection && (
          <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900 rounded-lg p-2 mt-2 max-w-xl">
            No METRC connection on file — sales will still ring up, but nothing will be reported
            for seed-to-sale tracking.{" "}
            <a href="/retailer/settings" className="underline">
              Connect METRC
            </a>
            .
          </p>
        )}
      </div>

      <PosTabs
        register={<RegisterPanel dailyPurchaseLimitOz={user?.dailyPurchaseLimitOz ?? null} />}
        orders={<OrdersPanel orders={orders} />}
        intake={<IntakePanel deals={deals} defaultMarkupPercent={user?.defaultMarkupPercent ?? null} />}
        inventory={<InventoryPanel lots={lots} />}
        history={<SalesHistoryPanel sales={sales} />}
        marketing={<MarketingPanel connection={smsConnection} optedInCount={optedInCount} messages={marketingMessages} />}
      />
    </PortalShell>
  );
}
