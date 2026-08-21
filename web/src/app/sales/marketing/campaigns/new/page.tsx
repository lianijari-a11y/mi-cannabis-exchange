import { requireRole } from "@/lib/dal";
import { PortalShell } from "@/components/portal-shell";
import { leadsForList, LEAD_LIST_KEYS, LEAD_LIST_LABELS, type LeadListKey } from "@/lib/leads";
import { isMessagingAiConfigured, MAX_CAMPAIGN_LEADS } from "@/lib/lead-messaging";
import { CampaignComposer } from "@/components/leads/campaign-composer";
import { previewCampaignAction, createCampaignAction } from "../actions";

const NAV = [
  { href: "/sales", label: "My accounts" },
  { href: "/sales/orders", label: "Orders" },
  { href: "/sales/negotiations", label: "Negotiations" },
  { href: "/sales/listings/new", label: "Post for a seller" },
  { href: "/sales/earnings", label: "My earnings" },
  { href: "/sales/marketing", label: "Marketing suite" },
  { href: "/sales/settings", label: "Settings" },
];

export default async function NewCampaignPage({
  searchParams,
}: {
  searchParams: Promise<{ list?: string }>;
}) {
  const session = await requireRole("sales_rep");
  const { list } = await searchParams;
  const listKey: LeadListKey = LEAD_LIST_KEYS.includes(list as LeadListKey) ? (list as LeadListKey) : "leads";
  const actor = { role: "sales_rep" as const, id: session.user.id };
  const leads = await leadsForList(listKey, false, actor);

  return (
    <PortalShell roleLabel="Account Executive" navItems={NAV}>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">New message campaign</h1>
        <a href="/sales/marketing/campaigns" className="text-xs text-green-700 dark:text-green-400 underline shrink-0">
          View campaigns →
        </a>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        Write one message, pick leads from a list, and Claude drafts a personalized version of it for each — you
        review and can edit every line before anything sends. Send right away, or schedule it (a week from now,
        for example) and it'll go out on its own.
      </p>

      <CampaignComposer
        listKey={listKey}
        listKeys={LEAD_LIST_KEYS}
        listLabels={LEAD_LIST_LABELS}
        leads={leads.map((l) => ({ id: l.id, company: l.company, contact: l.contact, phone: l.phone }))}
        aiConfigured={isMessagingAiConfigured()}
        maxLeads={MAX_CAMPAIGN_LEADS}
        basePath="/sales/marketing/campaigns"
        previewAction={previewCampaignAction}
        createAction={createCampaignAction}
      />
    </PortalShell>
  );
}
