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
} from "./actions";

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

export default async function AdminMarketingPage({
  searchParams,
}: {
  searchParams: Promise<{ list?: string }>;
}) {
  await requireRole("admin");
  const { list } = await searchParams;
  const listKey: LeadListKey = LEAD_LIST_KEYS.includes(list as LeadListKey) ? (list as LeadListKey) : "leads";

  const [leads, counts] = await Promise.all([leadsForList(listKey), leadCountsByList()]);

  return (
    <PortalShell roleLabel="Admin" navItems={NAV}>
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">Marketing suite</h1>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        Cold-calling lead lists shared with the sales team — core CRM only for now (call logging,
        disposition tracking, notes). Power Dialer, callback calendar, and dashboard are a planned
        follow-up.
      </p>

      <div className="flex gap-2 mb-4 flex-wrap">
        {LEAD_LIST_KEYS.map((k) => (
          <a
            key={k}
            href={`/admin/marketing?list=${k}`}
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
        }}
      />
    </PortalShell>
  );
}
