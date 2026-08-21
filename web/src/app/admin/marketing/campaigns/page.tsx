import { requireRole } from "@/lib/dal";
import { PortalShell } from "@/components/portal-shell";
import { campaignsForActor } from "@/lib/lead-messaging";
import { CampaignList } from "@/components/leads/campaign-list";
import { cancelCampaignAction } from "./actions";

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

export default async function AdminCampaignsPage() {
  const session = await requireRole("admin");
  const campaigns = await campaignsForActor({ role: "admin", id: session.user.id });

  return (
    <PortalShell roleLabel="Admin" navItems={NAV}>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Message campaigns</h1>
        <a
          href="/admin/marketing/campaigns/new"
          className="text-xs rounded-lg bg-green-700 text-white px-3 py-1.5 shrink-0"
        >
          + New campaign
        </a>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        Every AI-personalized text campaign platform-wide — scheduled ones are picked up automatically, nobody
        needs to be signed in when they go out.
      </p>
      <CampaignList campaigns={campaigns} cancelAction={cancelCampaignAction} />
    </PortalShell>
  );
}
