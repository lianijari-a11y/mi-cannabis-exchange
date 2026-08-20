import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { PortalShell } from "@/components/portal-shell";
import { accountDetailForAdmin } from "@/lib/admin";
import { MenuSection } from "@/components/sales/menu-section";
import { ROLE_LABELS, type Role } from "@/lib/constants";
import { editListingForAccount, bulkAddPhotosForAccount, bulkUpdatePricingForAccount } from "./actions";

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

// Admin's version of an Account Executive's account detail page
// (CLAUDE.md §38/§42) — same profile + comprehensive-menu view, but
// reachable for any Grower/Processor platform-wide, not just accounts
// assigned to one rep. Password reset isn't duplicated here — Admin
// already has that on /admin's own "All users" table (CLAUDE.md §37).
export default async function AdminAccountDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requireRole("admin");
  const { id } = await params;
  const { error } = await searchParams;
  const detail = await accountDetailForAdmin(id);
  if (!detail) notFound();
  const { seller, menus } = detail;
  const sellerLabel = seller.businessName ?? seller.fullName;
  const totalListings = menus.reduce((n, m) => n + m.listings.length, 0);

  return (
    <PortalShell roleLabel="Admin" navItems={NAV}>
      <Link href="/admin/accounts" className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
        ← Back to accounts
      </Link>

      {error && (
        <p className="mt-3 text-xs text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 rounded-lg p-2">
          {decodeURIComponent(error)}
        </p>
      )}

      <div className="mt-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
        <h1 className="font-semibold text-gray-900 dark:text-gray-100">{sellerLabel}</h1>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {ROLE_LABELS[seller.role as Role] ?? seller.role} · License {seller.licenseNumber ?? "—"}
          {seller.licenseType ? ` (${seller.licenseType})` : ""} · {seller.licenseVerification}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {seller.email}
          {seller.phone ? ` · ${seller.phone}` : ""}
        </p>
        {(seller.address || seller.city) && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {[seller.address, seller.city, seller.state, seller.zip].filter(Boolean).join(", ")}
          </p>
        )}
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {seller.assignedSalesRep
            ? `Assigned to ${seller.assignedSalesRep.fullName}`
            : "No Account Executive assigned"}
        </p>
      </div>

      <div className="mt-6">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Menus ({totalListings} product{totalListings === 1 ? "" : "s"} across {menus.length} menu
          {menus.length === 1 ? "" : "s"})
        </h2>
        {menus.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">No listings yet.</p>}
        <div className="space-y-3">
          {menus.map((menu) => (
            <MenuSection
              key={menu.batchId}
              batchId={menu.batchId}
              uploadedLabel={menu.createdAt.toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
              listings={menu.listings}
              editAction={editListingForAccount.bind(null, seller.id)}
              bulkPhotoSaveAction={bulkAddPhotosForAccount}
              bulkPriceSaveAction={bulkUpdatePricingForAccount}
            />
          ))}
        </div>
      </div>
    </PortalShell>
  );
}
