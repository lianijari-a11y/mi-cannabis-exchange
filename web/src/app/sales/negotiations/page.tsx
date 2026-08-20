import { requireRole } from "@/lib/dal";
import { PortalShell } from "@/components/portal-shell";
import { threadsForSalesRep } from "@/lib/offers";
import { NegotiationsDashboard } from "@/components/sales/negotiations-dashboard";

const NAV = [
  { href: "/sales", label: "My accounts" },
  { href: "/sales/orders", label: "Orders" },
  { href: "/sales/negotiations", label: "Negotiations" },
  { href: "/sales/listings/new", label: "Post for a seller" },
  { href: "/sales/earnings", label: "My earnings" },
  { href: "/sales/marketing", label: "Marketing suite" },
  { href: "/sales/settings", label: "Settings" },
];

// Real identity on both sides — a deliberate, confirmed reversal of the
// blind-marketplace boundary for the Account Executive role specifically.
// See CLAUDE.md and lib/offers.ts's threadsForSalesRep for the full
// rationale. Scoped to this rep's own assigned accounts only.
export default async function SalesNegotiationsPage() {
  const session = await requireRole("sales_rep");
  const threads = await threadsForSalesRep(session.user.id);

  return (
    <PortalShell roleLabel="Account Executive" navItems={NAV}>
      <NegotiationsDashboard threads={threads} scopeLabel="Every negotiation on your own accounts, in real identity on both sides" />
    </PortalShell>
  );
}
