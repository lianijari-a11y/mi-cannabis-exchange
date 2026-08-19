import { requireRole } from "@/lib/dal";
import { PortalShell } from "@/components/portal-shell";
import { SellerDashboard } from "@/components/seller/seller-dashboard";
import { bulkAddPhotosAction, bulkUpdatePricingAction } from "./actions";

const NAV = [
  { href: "/grower", label: "My listings" },
  { href: "/grower/listings/new", label: "Post inventory" },
  { href: "/grower/requests", label: "Buyer requests" },
  { href: "/grower/settings", label: "Settings" },
];

export default async function GrowerPage() {
  const session = await requireRole("grower");

  return (
    <PortalShell roleLabel="Grower" navItems={NAV}>
      <SellerDashboard
        sellerId={session.user.id}
        basePath="/grower"
        bulkPhotoSaveAction={bulkAddPhotosAction}
        bulkPriceSaveAction={bulkUpdatePricingAction}
      />
    </PortalShell>
  );
}
