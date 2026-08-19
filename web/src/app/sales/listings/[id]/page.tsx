import Link from "next/link";
import { notFound } from "next/navigation";
import { PortalShell } from "@/components/portal-shell";
import { EditListingForm } from "@/components/seller/edit-listing-form";
import { getListingForAssistantEdit } from "@/lib/sales-actions";
import { editListing } from "./actions";

const NAV = [
  { href: "/sales", label: "My accounts" },
  { href: "/sales/orders", label: "Orders" },
  { href: "/sales/negotiations", label: "Negotiations" },
  { href: "/sales/listings/new", label: "Post for a seller" },
  { href: "/sales/earnings", label: "My earnings" },
  { href: "/sales/marketing", label: "Marketing suite" },
];

// A menu keeps selling over days — the Account Executive who built it needs
// to be able to come back and adjust price/quantity/photos, not just post it
// once. Scoped to listings this AE personally created (createdBySalesRepId,
// checked in lib/listings.ts's updateListing) — see CLAUDE.md.
export default async function SalesEditListingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const listing = await getListingForAssistantEdit("sales_rep", id);
  if (!listing) notFound();

  return (
    <PortalShell roleLabel="Account Executive" navItems={NAV}>
      <Link href="/sales" className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
        ← Back to my activity
      </Link>
      <div className="mt-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 max-w-lg">
        <h1 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
          Edit listing{listing.status !== "active" ? ` (${listing.status})` : ""}
        </h1>
        {listing.status === "active" ? (
          <EditListingForm
            listing={listing}
            action={editListing}
            error={error ? decodeURIComponent(error) : undefined}
          />
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Only an active listing can be edited — this one is {listing.status}.
          </p>
        )}
      </div>
    </PortalShell>
  );
}
