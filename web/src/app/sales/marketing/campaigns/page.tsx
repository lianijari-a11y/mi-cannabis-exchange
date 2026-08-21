import { requireRole } from "@/lib/dal";
import { PortalShell } from "@/components/portal-shell";
import { campaignsForActor } from "@/lib/lead-messaging";
import { CampaignList } from "@/components/leads/campaign-list";
import { cancelCampaignAction } from "./actions";

const NAV = [
  { href: "/sales", label: "My accounts" },
  { href: "/sales/orders", label: "Orders" },
  { href: "/sales/negotiations", label: "Negotiations" },
  { href: "/sales/listings/new", label: "Post for a seller" },
  { href: "/sales/earnings", label: "My earnings" },
  { href: "/sales/marketing", label: "Marketing suite" },
  { href: "/sales/settings", label: "Settings" },
];

export default async function CampaignsPage() {
  const session = await requireRole("sales_rep");
  const campaigns = await campaignsForActor({ role: "sales_rep", id: session.user.id });

  return (
    <PortalShell roleLabel="Account Executive" navItems={NAV}>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Message campaigns</h1>
        <a
          href="/sales/marketing/campaigns/new"
          className="text-xs rounded-lg bg-green-700 text-white px-3 py-1.5 shrink-0"
        >
          + New campaign
        </a>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        Your own AI-personalized text blasts — scheduled ones are picked up automatically, you don't need to be
        signed in when they go out.
      </p>
      <CampaignList campaigns={campaigns} cancelAction={cancelCampaignAction} />
    </PortalShell>
  );
}
