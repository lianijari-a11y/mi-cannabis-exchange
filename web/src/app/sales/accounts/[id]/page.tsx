import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { PortalShell } from "@/components/portal-shell";
import { accountDetailForSalesRep } from "@/lib/sales-actions";
import { MenuSection } from "@/components/sales/menu-section";
import { InlineResetPassword } from "@/components/sales/inline-reset-password";
import { ROLE_LABELS, type Role } from "@/lib/constants";
import { editListingForAccount, bulkAddPhotosForAccount, bulkUpdatePricingForAccount } from "./actions";

const NAV = [
  { href: "/sales", label: "My accounts" },
  { href: "/sales/orders", label: "Orders" },
  { href: "/sales/negotiations", label: "Negotiations" },
  { href: "/sales/listings/new", label: "Post for a seller" },
  { href: "/sales/earnings", label: "My earnings" },
  { href: "/sales/marketing", label: "Marketing suite" },
];

// One account's full profile + comprehensive menu (CLAUDE.md §38) — every
// listing that grower/processor has ever posted, each independently
// editable in place. This is the page the original request was actually
// asking for: not a flat pile of individual strain listings, but "under
// that client grower, you should be able to see the menu and the menu
// should be editable."
export default async function AccountDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireRole("sales_rep");
  const { id } = await params;
  const { error } = await searchParams;
  const detail = await accountDetailForSalesRep(session.user.id, id);
  if (!detail) notFound();
  const { seller, menus } = detail;
  const sellerLabel = seller.businessName ?? seller.fullName;
  const totalListings = menus.reduce((n, m) => n + m.listings.length, 0);

  return (
    <PortalShell roleLabel="Account Executive" navItems={NAV}>
      <Link href="/sales" className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
        ← Back to my accounts
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
        <div className="mt-3">
          <InlineResetPassword sellerId={seller.id} sellerLabel={sellerLabel} />
        </div>
      </div>

      <div className="mt-6">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Menus ({totalListings} product{totalListings === 1 ? "" : "s"} across {menus.length} menu
          {menus.length === 1 ? "" : "s"})
        </h2>
        {menus.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No listings yet.{" "}
            <Link href="/sales/listings/new" className="text-green-700 dark:text-green-400 underline">
              Post one for this seller
            </Link>
            .
          </p>
        )}
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
