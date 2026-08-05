import { requireRole } from "@/lib/dal";
import { PortalShell } from "@/components/portal-shell";
import { SellerDashboard } from "@/components/seller/seller-dashboard";

const NAV = [
  { href: "/processor", label: "My listings" },
  { href: "/processor/listings/new", label: "Post inventory" },
];

export default async function ProcessorPage() {
  const session = await requireRole("processor");

  return (
    <PortalShell roleLabel="Processor" navItems={NAV}>
      <SellerDashboard sellerId={session.user.id} basePath="/processor" />
    </PortalShell>
  );
}
