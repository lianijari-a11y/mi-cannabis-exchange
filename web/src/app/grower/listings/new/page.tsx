import { requireRole } from "@/lib/dal";
import { PortalShell } from "@/components/portal-shell";
import { ListingForm } from "@/components/seller/listing-form";
import { createListing } from "./actions";

const NAV = [
  { href: "/grower", label: "My listings" },
  { href: "/grower/listings/new", label: "Post inventory" },
];

export default async function NewGrowerListingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireRole("grower");
  const { error } = await searchParams;

  return (
    <PortalShell roleLabel="Grower" navItems={NAV}>
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Post inventory
      </h1>
      <ListingForm action={createListing} error={error} />
    </PortalShell>
  );
}
