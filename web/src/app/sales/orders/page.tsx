import { requireRole } from "@/lib/dal";
import { PortalShell } from "@/components/portal-shell";
import { ordersForActor } from "@/lib/cart-order-management";
import { OrdersList } from "@/components/sales/orders-list";
import { cancelOrderAction } from "./actions";

const NAV = [
  { href: "/sales", label: "My accounts" },
  { href: "/sales/orders", label: "Orders" },
  { href: "/sales/listings/new", label: "Post for a seller" },
  { href: "/sales/earnings", label: "My earnings" },
  { href: "/sales/marketing", label: "Marketing suite" },
];

// Cart orders (CLAUDE.md §41) touching this rep's own assigned accounts —
// "a button for account rep to cancel an order" (CLAUDE.md §42). A cart
// order can span several sellers; only lines belonging to this rep's own
// accounts show up here, and cancel only ever pulls back those lines.
export default async function SalesOrdersPage() {
  const session = await requireRole("sales_rep");
  const orders = await ordersForActor("sales_rep", session.user.id);

  return (
    <PortalShell roleLabel="Account Executive" navItems={NAV}>
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">Orders</h1>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        Every cart order touching your own accounts, retailer side shown anonymized as usual.
        Canceling rejects whatever&apos;s still open on your accounts&apos; lines — it acts as
        that seller, the same standing you already have to edit their listings.
      </p>
      <OrdersList orders={orders} cancelAction={cancelOrderAction} />
    </PortalShell>
  );
}
