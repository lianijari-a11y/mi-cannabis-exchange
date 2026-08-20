import { requireRole } from "@/lib/dal";
import { PortalShell } from "@/components/portal-shell";
import { ordersForActor } from "@/lib/cart-order-management";
import { OrdersList } from "@/components/sales/orders-list";
import { cancelOrderAction } from "./actions";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/listings", label: "All listings" },
  { href: "/admin/accounts", label: "Accounts" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/negotiations", label: "Negotiations" },
  { href: "/admin/listings/new", label: "Post for a seller" },
  { href: "/admin/staff/new", label: "Add staff account" },
  { href: "/admin/sales-reps", label: "Account Executive earnings" },
  { href: "/admin/data-uploads", label: "Data uploads" },
  { href: "/admin/metrc", label: "METRC" },
  { href: "/admin/system-health", label: "System health" },
  { href: "/admin/marketing", label: "Marketing suite" },
  { href: "/admin/settings", label: "Settings" },
];

// Admin's version of the AE's orders page (CLAUDE.md §42) — every cart
// order platform-wide, not scoped to one rep's own accounts, matching
// Admin's usual unrestricted reach.
export default async function AdminOrdersPage() {
  const session = await requireRole("admin");
  const orders = await ordersForActor("admin", session.user.id);

  return (
    <PortalShell roleLabel="Admin" navItems={NAV}>
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">Orders</h1>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        Every cart order platform-wide, retailer side shown anonymized as usual. Canceling rejects
        whatever&apos;s still open on that order — it acts as the listing&apos;s own seller.
      </p>
      <OrdersList orders={orders} cancelAction={cancelOrderAction} />
    </PortalShell>
  );
}
