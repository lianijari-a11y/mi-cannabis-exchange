import Link from "next/link";
import { notFound } from "next/navigation";
import { PortalShell } from "@/components/portal-shell";
import { EditListingForm } from "@/components/seller/edit-listing-form";
import { getListingForAssistantEdit } from "@/lib/sales-actions";
import { editListing } from "./actions";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/listings", label: "All listings" },
  { href: "/admin/listings/new", label: "Post for a seller" },
  { href: "/admin/staff/new", label: "Add staff account" },
  { href: "/admin/sales-reps", label: "Account Executive earnings" },
  { href: "/admin/data-uploads", label: "Data uploads" },
  { href: "/admin/metrc", label: "METRC" },
  { href: "/admin/system-health", label: "System health" },
  { href: "/admin/marketing", label: "Marketing suite" },
];

// Admin can edit ANY listing platform-wide, not just ones Admin itself
// created — matches Admin's existing unrestricted reach elsewhere (e.g.
// updateListingVisibility). See CLAUDE.md.
export default async function AdminEditListingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const listing = await getListingForAssistantEdit("admin", id);
  if (!listing) notFound();

  return (
    <PortalShell roleLabel="Admin" navItems={NAV}>
      <Link href="/admin/listings" className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
        ← Back to all listings
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
