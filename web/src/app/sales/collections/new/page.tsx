import { requireRole } from "@/lib/dal";
import { PortalShell } from "@/components/portal-shell";
import { menusForCollectionPicker } from "@/lib/menu-collections";
import { TermsDisclaimer } from "@/components/cart/terms-disclaimer";
import { CollectionPickerForm } from "@/components/sales/collection-picker-form";
import { createCollectionAction } from "./actions";

const NAV = [
  { href: "/sales", label: "My accounts" },
  { href: "/sales/orders", label: "Orders" },
  { href: "/sales/negotiations", label: "Negotiations" },
  { href: "/sales/listings/new", label: "Post for a seller" },
  { href: "/sales/earnings", label: "My earnings" },
  { href: "/sales/marketing", label: "Marketing suite" },
  { href: "/sales/settings", label: "Settings" },
];

// "An account rep has 14 menus from 14 different growers, all 14 can be
// grouped and shared with one link" (CLAUDE.md §40) — pick any number of
// menus across the AE's own assigned accounts and bundle them into one
// shareable browse-and-order link.
export default async function NewCollectionPage() {
  const session = await requireRole("sales_rep");
  const menus = await menusForCollectionPicker(session.user.id);

  return (
    <PortalShell roleLabel="Account Executive" navItems={NAV}>
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
        Build a shareable link across menus
      </h1>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        Pick any menus from your accounts below — everyone who opens the link can see and order
        from all of them together.
      </p>

      {menus.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          None of your accounts have an active menu yet.
        </p>
      ) : (
        <CollectionPickerForm menus={menus} action={createCollectionAction}>
          <TermsDisclaimer />
        </CollectionPickerForm>
      )}
    </PortalShell>
  );
}
