import { requireRole } from "@/lib/dal";
import { PortalShell } from "@/components/portal-shell";
import { menusForAdminCollectionPicker } from "@/lib/menu-collections";
import { TermsDisclaimer } from "@/components/cart/terms-disclaimer";
import { CollectionPickerForm } from "@/components/sales/collection-picker-form";
import { createCollectionAction } from "./actions";

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
];

// Admin's version of the AE's collection builder (CLAUDE.md §40/§42) —
// same "pick any menus, bundle into one shareable link" tool, but the
// picker is platform-wide, not scoped to one rep's own assigned accounts.
export default async function AdminNewCollectionPage() {
  await requireRole("admin");
  const menus = await menusForAdminCollectionPicker();

  return (
    <PortalShell roleLabel="Admin" navItems={NAV}>
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
        Build a shareable link across menus
      </h1>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        Pick any menus from any Grower/Processor on the platform — everyone who opens the link can
        see and order from all of them together.
      </p>

      {menus.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">No active menus yet.</p>
      ) : (
        <CollectionPickerForm menus={menus} action={createCollectionAction}>
          <TermsDisclaimer />
        </CollectionPickerForm>
      )}
    </PortalShell>
  );
}
