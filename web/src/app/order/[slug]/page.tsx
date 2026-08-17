import { notFound } from "next/navigation";
import { retailerByStorefrontSlug, publicMenuForRetailer } from "@/lib/storefront";
import { StorefrontMenu } from "@/components/storefront/storefront-menu";

// Public, no auth, no PortalShell — the one page in this app a random
// member of the public reaches beyond the marketing landing page. See
// CLAUDE.md §25 for the scope decisions (per-retailer, guest checkout,
// pay-at-pickup, age-attestation-only) behind this route.
export default async function StorefrontPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const retailer = await retailerByStorefrontSlug(slug);
  if (!retailer) notFound();

  const items = await publicMenuForRetailer(retailer.id);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <StorefrontMenu slug={slug} businessName={retailer.businessName ?? "Dispensary"} items={items} />
    </div>
  );
}
