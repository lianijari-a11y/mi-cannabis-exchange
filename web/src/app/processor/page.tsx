import { requireRole } from "@/lib/dal";
import { PortalShell } from "@/components/portal-shell";
import { SellerDashboard } from "@/components/seller/seller-dashboard";
import { bulkAddPhotosAction } from "./actions";

const NAV = [
  { href: "/processor", label: "My listings" },
  { href: "/processor/sourcing", label: "Sourcing" },
  { href: "/processor/contracts", label: "My contracts" },
  { href: "/processor/listings/new", label: "Post inventory" },
  { href: "/processor/requests", label: "Buyer requests" },
  { href: "/processor/settings", label: "Settings" },
];

export default async function ProcessorPage() {
  const session = await requireRole("processor");

  return (
    <PortalShell roleLabel="Processor" navItems={NAV}>
      <SellerDashboard sellerId={session.user.id} basePath="/processor" bulkPhotoSaveAction={bulkAddPhotosAction} />
    </PortalShell>
  );
}
