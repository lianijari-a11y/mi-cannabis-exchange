import { requireRole } from "@/lib/dal";
import { PortalShell } from "@/components/portal-shell";
import { leadsForList, leadCountsByList, LEAD_LIST_KEYS, LEAD_LIST_LABELS, type LeadListKey } from "@/lib/leads";
import { LeadsManager } from "@/components/leads/leads-manager";
import {
  createLeadAction,
  updateLeadAction,
  setDispositionAction,
  logCallAction,
  addNoteAction,
  deleteLeadAction,
  restoreLeadAction,
  lookupContactAction,
  applyContactInfoAction,
  sendTextAction,
  addPhoneNumberAction,
  updatePhoneNumberAction,
  removePhoneNumberAction,
  setPhoneNumberPositionAction,
} from "./actions";

const NAV = [
  { href: "/sales", label: "My accounts" },
  { href: "/sales/orders", label: "Orders" },
  { href: "/sales/negotiations", label: "Negotiations" },
  { href: "/sales/listings/new", label: "Post for a seller" },
  { href: "/sales/earnings", label: "My earnings" },
  { href: "/sales/marketing", label: "Marketing suite" },
  { href: "/sales/settings", label: "Settings" },
];

export default async function SalesMarketingPage({
  searchParams,
}: {
  searchParams: Promise<{ list?: string }>;
}) {
  const session = await requireRole("sales_rep");
  const { list } = await searchParams;
  const listKey: LeadListKey = LEAD_LIST_KEYS.includes(list as LeadListKey) ? (list as LeadListKey) : "leads";

  const actor = { role: "sales_rep" as const, id: session.user.id };
  const [leads, counts] = await Promise.all([leadsForList(listKey, false, actor), leadCountsByList(actor)]);

  return (
    <PortalShell roleLabel="Account Executive" navItems={NAV}>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Marketing suite</h1>
        <a
          href="/sales/marketing/campaigns"
          className="text-xs rounded-lg bg-green-700 text-white px-3 py-1.5 shrink-0"
        >
          Message campaigns →
        </a>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        Cold-calling lead lists for soliciting inventory from growers/processors — call logging,
        disposition tracking, notes, texting, the Power Dialer, callback calendar, and dashboard
        (buttons below the list). Message campaigns lets you AI-personalize and send (or
        schedule) a text to many leads at once.
      </p>

      <div className="flex gap-2 mb-4 flex-wrap">
        {LEAD_LIST_KEYS.map((k) => (
          <a
            key={k}
            href={`/sales/marketing?list=${k}`}
            className={`text-xs rounded-lg px-3 py-1.5 border ${
              k === listKey
                ? "bg-green-700 text-white border-green-700"
                : "border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300"
            }`}
          >
            {LEAD_LIST_LABELS[k]} ({counts[k] ?? 0})
          </a>
        ))}
      </div>

      <LeadsManager
        leads={leads.map((l) => ({ ...l, activity: l.activity }))}
        listKey={listKey}
        actions={{
          createLeadAction,
          updateLeadAction,
          setDispositionAction,
          logCallAction,
          addNoteAction,
          deleteLeadAction,
          restoreLeadAction,
          lookupContactAction,
          applyContactInfoAction,
          sendTextAction,
          addPhoneNumberAction,
          updatePhoneNumberAction,
          removePhoneNumberAction,
          setPhoneNumberPositionAction,
        }}
      />
    </PortalShell>
  );
}
