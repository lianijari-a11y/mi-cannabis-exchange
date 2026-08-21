"use client";

import { useMemo, useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";

export type ComposerLead = { id: string; company: string; contact: string | null; phone: string | null };

type PreviewResult = {
  personalized: boolean;
  drafts: { leadId: string; text: string }[];
  note?: string;
  leadsById: Record<string, { id: string; company: string; contact: string | null }>;
  excludedDnc: number;
  excludedNotVisible: number;
};

type Props = {
  listKey: string;
  listKeys: readonly string[];
  listLabels: Record<string, string>;
  leads: ComposerLead[];
  aiConfigured: boolean;
  maxLeads: number;
  basePath: string; // "/sales/marketing/campaigns" or "/admin/marketing/campaigns"
  previewAction: (templateText: string, leadIds: string[]) => Promise<PreviewResult>;
  createAction: (
    templateText: string,
    items: { leadId: string; text: string }[],
    scheduledForIso: string | null,
    personalized: boolean
  ) => Promise<void>;
};

function quickDate(daysFromNow: number): string {
  const d = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000);
  d.setSeconds(0, 0);
  // datetime-local wants local time, no timezone suffix
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CampaignComposer({
  listKey,
  listKeys,
  listLabels,
  leads,
  aiConfigured,
  maxLeads,
  basePath,
  previewAction,
  createAction,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [template, setTemplate] = useState("");
  const [step, setStep] = useState<"select" | "review">("select");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [draftTexts, setDraftTexts] = useState<Record<string, string>>({});
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [scheduleMode, setScheduleMode] = useState<"now" | "later">("now");
  const [scheduledAt, setScheduledAt] = useState(quickDate(7));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter(
      (l) =>
        l.company.toLowerCase().includes(q) ||
        (l.contact ?? "").toLowerCase().includes(q) ||
        (l.phone ?? "").toLowerCase().includes(q)
    );
  }, [leads, search]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((l) => selected.has(l.id));

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllFiltered() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filtered.forEach((l) => next.delete(l.id));
      } else {
        filtered.forEach((l) => next.add(l.id));
      }
      return next;
    });
  }

  function runPreview() {
    setError(null);
    if (!template.trim()) {
      setError("Write a message first.");
      return;
    }
    if (selected.size === 0) {
      setError("Select at least one lead.");
      return;
    }
    if (selected.size > maxLeads) {
      setError(`Select ${maxLeads} or fewer leads per campaign — split a larger send into more than one.`);
      return;
    }
    startTransition(async () => {
      try {
        const result = await previewAction(template, [...selected]);
        setPreview(result);
        setDraftTexts(Object.fromEntries(result.drafts.map((d) => [d.leadId, d.text])));
        setRemoved(new Set());
        setStep("review");
      } catch (err) {
        unstable_rethrow(err);
        setError(err instanceof Error ? err.message : "Couldn't build the preview — try again.");
      }
    });
  }

  function submit() {
    if (!preview) return;
    setError(null);
    const items = preview.drafts
      .filter((d) => !removed.has(d.leadId))
      .map((d) => ({ leadId: d.leadId, text: (draftTexts[d.leadId] ?? d.text).trim() }))
      .filter((i) => i.text);
    if (items.length === 0) {
      setError("Every message was removed or emptied — nothing to send.");
      return;
    }
    const scheduledForIso = scheduleMode === "later" ? new Date(scheduledAt).toISOString() : null;
    startTransition(async () => {
      try {
        await createAction(template, items, scheduledForIso, preview.personalized);
      } catch (err) {
        unstable_rethrow(err);
        setError(err instanceof Error ? err.message : "Couldn't create the campaign — try again.");
      }
    });
  }

  const visibleDrafts = preview?.drafts.filter((d) => !removed.has(d.leadId)) ?? [];

  if (step === "review" && preview) {
    return (
      <div className="max-w-2xl space-y-4">
        <button
          type="button"
          onClick={() => setStep("select")}
          className="text-[11px] text-green-700 dark:text-green-400 underline"
        >
          ← Back to lead selection
        </button>

        {preview.note && (
          <p className="text-xs rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 p-2.5">
            {preview.note}
          </p>
        )}
        {(preview.excludedDnc > 0 || preview.excludedNotVisible > 0) && (
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            {preview.excludedDnc > 0 && `${preview.excludedDnc} lead(s) skipped — marked Do Not Call. `}
            {preview.excludedNotVisible > 0 && `${preview.excludedNotVisible} lead(s) skipped — assigned to another Account Executive.`}
          </p>
        )}

        <div>
          <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
            Review each message ({visibleDrafts.length}) — edit or remove any line before sending
          </p>
          <div className="space-y-2 max-h-[28rem] overflow-y-auto pr-1">
            {visibleDrafts.map((d) => {
              const meta = preview.leadsById[d.leadId];
              return (
                <div
                  key={d.leadId}
                  className="rounded-lg border border-gray-200 dark:border-gray-800 p-2.5 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-900 dark:text-gray-100">
                      {meta?.company ?? "Lead"}
                      {meta?.contact ? ` — ${meta.contact}` : ""}
                    </span>
                    <button
                      type="button"
                      onClick={() => setRemoved((prev) => new Set(prev).add(d.leadId))}
                      className="text-[11px] text-red-600 dark:text-red-400"
                    >
                      Remove
                    </button>
                  </div>
                  <textarea
                    value={draftTexts[d.leadId] ?? d.text}
                    onChange={(e) => setDraftTexts((prev) => ({ ...prev, [d.leadId]: e.target.value }))}
                    rows={2}
                    className="w-full text-xs rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-2"
                  />
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-3 space-y-2">
          <p className="text-xs font-medium text-gray-700 dark:text-gray-300">When should this send?</p>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="radio"
              checked={scheduleMode === "now"}
              onChange={() => setScheduleMode("now")}
            />
            Send as soon as possible
          </label>
          {scheduleMode === "now" && (
            <p className="pl-6 text-[10px] text-gray-500 dark:text-gray-400">
              Most sends go out right away. A very large batch may finish over the next day via the same
              once-daily check that handles scheduled sends.
            </p>
          )}
          <label className="flex items-center gap-2 text-xs">
            <input
              type="radio"
              checked={scheduleMode === "later"}
              onChange={() => setScheduleMode("later")}
            />
            Schedule for a specific date &amp; time
          </label>
          {scheduleMode === "later" && (
            <div className="pl-6 space-y-2">
              <input
                type="datetime-local"
                value={scheduledAt}
                min={quickDate(0)}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="text-xs rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-1.5"
              />
              <div className="flex gap-1.5 flex-wrap">
                {[
                  { label: "In 1 day", days: 1 },
                  { label: "In 3 days", days: 3 },
                  { label: "In 1 week", days: 7 },
                  { label: "In 2 weeks", days: 14 },
                ].map((q) => (
                  <button
                    key={q.label}
                    type="button"
                    onClick={() => setScheduledAt(quickDate(q.days))}
                    className="text-[11px] rounded-full border border-gray-300 dark:border-gray-700 px-2 py-1 text-gray-600 dark:text-gray-300"
                  >
                    {q.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-gray-500 dark:text-gray-400">
                Scheduled sends are picked up on a once-daily check — exact time isn't guaranteed, but the date
                you set is honored to within about a day. Great for "a week from now," less precise for "in 2
                hours."
              </p>
            </div>
          )}
        </div>

        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

        <button
          type="button"
          onClick={submit}
          disabled={isPending}
          className="rounded-lg bg-green-700 text-white text-xs font-medium px-4 py-2 disabled:opacity-50"
        >
          {isPending
            ? "Working…"
            : scheduleMode === "later"
            ? `Schedule ${visibleDrafts.length} message(s)`
            : `Send ${visibleDrafts.length} message(s) now`}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex gap-2 flex-wrap">
        {listKeys.map((k) => (
          <a
            key={k}
            href={`${basePath}/new?list=${k}`}
            className={`text-xs rounded-lg px-3 py-1.5 border ${
              k === listKey
                ? "bg-green-700 text-white border-green-700"
                : "border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300"
            }`}
          >
            {listLabels[k]}
          </a>
        ))}
      </div>
      <p className="text-[11px] text-gray-500 dark:text-gray-400">
        A campaign targets leads from one list at a time — switching lists above clears your current selection.
      </p>

      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Message template</label>
        <textarea
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
          rows={3}
          placeholder="e.g. Hey {name}, we've got fresh flower in this week at a great wholesale price — want me to send the menu?"
          className="w-full text-xs rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-2"
        />
        <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
          {aiConfigured
            ? "Claude will lightly personalize this for each selected lead using their name/company — you review and can edit every line before anything sends."
            : "AI personalization isn't configured on this deployment — the same message will go to everyone (still fully editable before sending)."}
        </p>
      </div>

      <div className="flex items-center justify-between">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search this list…"
          className="text-xs rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5 w-48"
        />
        <label className="flex items-center gap-1.5 text-[11px] text-gray-600 dark:text-gray-300">
          <input type="checkbox" checked={allFilteredSelected} onChange={toggleAllFiltered} />
          Select all filtered ({filtered.length})
        </label>
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-gray-800 max-h-80 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
        {filtered.map((l) => (
          <label
            key={l.id}
            className="flex items-center gap-2 px-2.5 py-1.5 text-xs cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900"
          >
            <input type="checkbox" checked={selected.has(l.id)} onChange={() => toggleOne(l.id)} />
            <span className="text-gray-900 dark:text-gray-100">{l.company}</span>
            {l.contact && <span className="text-gray-500 dark:text-gray-400">— {l.contact}</span>}
            {!l.phone && <span className="text-[10px] text-amber-600 dark:text-amber-400 ml-auto">no phone</span>}
          </label>
        ))}
        {filtered.length === 0 && <p className="text-xs text-gray-500 p-3">No leads match.</p>}
      </div>

      <p className="text-[11px] text-gray-600 dark:text-gray-300">
        {selected.size} selected {selected.size > maxLeads && `— select ${maxLeads} or fewer per campaign`}
      </p>

      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

      <button
        type="button"
        onClick={runPreview}
        disabled={isPending}
        className="rounded-lg bg-green-700 text-white text-xs font-medium px-4 py-2 disabled:opacity-50"
      >
        {isPending ? "Working…" : "Preview & personalize →"}
      </button>
    </div>
  );
}
