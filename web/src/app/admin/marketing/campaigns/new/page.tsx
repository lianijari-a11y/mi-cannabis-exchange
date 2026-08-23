import { requireRole } from "@/lib/dal";
import { PortalShell } from "@/components/portal-shell";
import { leadsForList, LEAD_LIST_KEYS, LEAD_LIST_LABELS, type LeadListKey } from "@/lib/leads";
import { isMessagingAiConfigured, MAX_CAMPAIGN_LEADS } from "@/lib/lead-messaging";
import { isEmailConfigured } from "@/lib/email";
import { CampaignComposer } from "@/components/leads/campaign-composer";
import { previewCampaignAction, createCampaignAction } from "../actions";

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

export default async function AdminNewCampaignPage({
  searchParams,
}: {
  searchParams: Promise<{ list?: string }>;
}) {
  await requireRole("admin");
  const { list } = await searchParams;
  const listKey: LeadListKey = LEAD_LIST_KEYS.includes(list as LeadListKey) ? (list as LeadListKey) : "leads";
  const leads = await leadsForList(listKey);

  return (
    <PortalShell roleLabel="Admin" navItems={NAV}>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">New message campaign</h1>
        <a href="/admin/marketing/campaigns" className="text-xs text-green-700 dark:text-green-400 underline shrink-0">
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
        leads={leads.map((l) => ({ id: l.id, company: l.company, contact: l.contact, phone: l.phone, email: l.email }))}
        aiConfigured={isMessagingAiConfigured()}
        emailConfigured={isEmailConfigured()}
        maxLeads={MAX_CAMPAIGN_LEADS}
        basePath="/admin/marketing/campaigns"
        previewAction={previewCampaignAction}
        createAction={createCampaignAction}
      />
    </PortalShell>
  );
}
