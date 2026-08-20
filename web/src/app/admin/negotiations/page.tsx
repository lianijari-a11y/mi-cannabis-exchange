import { requireRole } from "@/lib/dal";
import { PortalShell } from "@/components/portal-shell";
import { allThreadsForBroker } from "@/lib/offers";
import { NegotiationsDashboard } from "@/components/sales/negotiations-dashboard";

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

// Admin's version of the AE's negotiations page — reuses
// allThreadsForBroker() directly rather than a second query function,
// since Admin already has that same unrestricted platform-wide reach
// (real identity on both sides, every negotiation, not scoped to any one
// rep's own accounts).
export default async function AdminNegotiationsPage() {
  await requireRole("admin");
  const threads = await allThreadsForBroker();

  return (
    <PortalShell roleLabel="Admin" navItems={NAV}>
      <NegotiationsDashboard threads={threads} scopeLabel="Every negotiation on the platform, in real identity on both sides" />
    </PortalShell>
  );
}
