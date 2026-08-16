import { requireRole } from "@/lib/dal";
import { PortalShell } from "@/components/portal-shell";
import { ListingForm } from "@/components/seller/listing-form";
import { createListing } from "./actions";

const NAV = [
  { href: "/processor", label: "My listings" },
  { href: "/processor/sourcing", label: "Sourcing" },
  { href: "/processor/contracts", label: "My contracts" },
  { href: "/processor/listings/new", label: "Post inventory" },
];

export default async function NewProcessorListingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireRole("processor");
  const { error } = await searchParams;

  return (
    <PortalShell roleLabel="Processor" navItems={NAV}>
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Post inventory
      </h1>
      <ListingForm action={createListing} error={error} />
    </PortalShell>
  );
}
