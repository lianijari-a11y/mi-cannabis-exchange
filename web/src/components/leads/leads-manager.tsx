"use client";

import { useMemo, useState } from "react";
import {
  LEAD_DISPOSITIONS,
  LEAD_DISPOSITION_LABELS,
  type LeadDisposition,
  type LeadListKey,
} from "@/lib/leads-constants";
import { PowerDialer } from "./power-dialer";
import { CallbackCalendar } from "./callback-calendar";
import { LeadDashboard } from "./lead-dashboard";
import { ContactLookupButton } from "./contact-lookup-button";
import { LeadPhoneNumbersEditor } from "./lead-phone-numbers-editor";

type LeadActivity = { id: string; text: string; createdAt: string | Date };
export type LeadPhoneNumberRecord = {
  id: string;
  phone: string;
  name: string | null;
  sortOrder: number;
  blocked: boolean;
  blockedReason: string | null;
};

export type LeadRecord = {
  id: string;
  listKey: string;
  primaryStatus: string;
  company: string;
  contact: string | null;
  phone: string | null;
  altPhone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  license: string | null;
  licenseType: string | null;
  licenseStatus: string | null;
  serviceZone: string | null;
  notes: string | null;
  assignedRepName: string | null;
  disposition: string;
  saleAmount: number | null;
  callbackDate: string | Date | null;
  calledCount: number;
  lastCallAt: string | Date | null;
  deleted: boolean;
  activity: LeadActivity[];
  phoneNumbers: LeadPhoneNumberRecord[];
};

const DISP_COLORS: Record<string, { color: string; bg: string }> = {
  NEW: { color: "#6b7c93", bg: "#e8edf220" },
  NO_PHONE: { color: "#b8860b", bg: "#faf1d820" },
  NO_ANSWER: { color: "#8a6d3b", bg: "#f3ecdc20" },
  BUSY: { color: "#6b5ca8", bg: "#e9e5f520" },
  CALLBACK: { color: "#a8763e", bg: "#f3e6d320" },
  EMAIL_SENT: { color: "#3b6ea5", bg: "#e4edf520" },
  SALE: { color: "#2f5d4f", bg: "#dceee620" },
  DISCONNECTED: { color: "#8a6d3b", bg: "#f3ecdc20" },
  DECLINED: { color: "#a84432", bg: "#f4ddd820" },
  DNC: { color: "#a84432", bg: "#f4ddd820" },
};

function fmtPhone(p: string | null) {
  const d = (p || "").replace(/\D/g, "");
  if (d.length < 10) return p || "—";
  const last10 = d.slice(-10);
  return `(${last10.slice(0, 3)}) ${last10.slice(3, 6)}-${last10.slice(6)}`;
}
function telHref(p: string | null) {
  const d = (p || "").replace(/\D/g, "");
  if (d.length < 7) return null;
  return "tel:+1" + d.slice(-10);
}

// Default the "Text back" datetime-local input to an hour from now — a
// round, likely-not-in-the-past starting point the rep can freely change.
function defaultScheduleTime(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function nowForMin(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function LeadsManager({
  leads,
  listKey,
  actions,
}: {
  leads: LeadRecord[];
  listKey: LeadListKey;
  actions: {
    createLeadAction: (formData: FormData) => Promise<void>;
    // Can reject with an error (e.g. "already being worked by another
    // Account Executive" — see lib/leads.ts's claimOrVerifyLeadAssignment)
    // now that leads have real per-AE ownership, so both return a result
    // instead of a bare void.
    setDispositionAction: (
      id: string,
      disposition: LeadDisposition,
      saleAmount?: number | null,
      callbackDate?: Date | null
    ) => Promise<{ ok: boolean; error?: string }>;
    logCallAction: (id: string) => Promise<{ ok: boolean; error?: string }>;
    addNoteAction: (id: string, text: string) => Promise<void>;
    deleteLeadAction: (id: string) => Promise<void>;
    restoreLeadAction: (id: string) => Promise<void>;
    updateLeadAction: (id: string, fields: Record<string, unknown>) => Promise<void>;
    lookupContactAction?: (
      id: string
    ) => Promise<{ ok: true; phone: string | null; email: string | null; source: string | null } | { ok: false; error: string }>;
    applyContactInfoAction?: (id: string, phone: string | null, email: string | null) => Promise<{ ok: boolean; error?: string }>;
    // Optional — only wired in where lib/voipms-sms.ts is actually
    // configured; pages that don't pass it just don't show the Text
    // button, same "optional prop, gate on presence" pattern as the two
    // contact-lookup actions above.
    sendTextAction?: (id: string, text: string) => Promise<{ ok: true } | { ok: false; error: string }>;
    // "Text back" — schedules a text for a future date/time instead of
    // sending immediately, right from the same row as the disposition
    // controls. Same optional-prop gating as sendTextAction, since it
    // routes through the same VoIP.ms-backed send at delivery time.
    scheduleTextAction?: (
      id: string,
      text: string,
      scheduledForIso: string
    ) => Promise<{ ok: true } | { ok: false; error: string }>;
    // Email twins of sendTextAction/scheduleTextAction — same optional,
    // gate-on-presence pattern, only wired in where lib/email.ts's Resend
    // is actually configured.
    sendEmailAction?: (id: string, subject: string, body: string) => Promise<{ ok: true } | { ok: false; error: string }>;
    scheduleEmailAction?: (
      id: string,
      subject: string,
      body: string,
      scheduledForIso: string
    ) => Promise<{ ok: true } | { ok: false; error: string }>;
    addPhoneNumberAction: (leadId: string, phone: string, name: string) => Promise<void>;
    updatePhoneNumberAction: (id: string, phone: string, name: string) => Promise<void>;
    removePhoneNumberAction: (id: string) => Promise<void>;
    setPhoneNumberPositionAction: (leadId: string, phoneNumberId: string, position: 0 | 1) => Promise<void>;
  };
}) {
  const [search, setSearch] = useState("");
  const [dispFilter, setDispFilter] = useState<Set<string>>(new Set(LEAD_DISPOSITIONS));
  const [showDeleted, setShowDeleted] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [noteDraftId, setNoteDraftId] = useState<string | null>(null);
  const [textDraftId, setTextDraftId] = useState<string | null>(null);
  const [textError, setTextError] = useState<string | null>(null);
  const [scheduleDraftId, setScheduleDraftId] = useState<string | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleSuccessId, setScheduleSuccessId] = useState<string | null>(null);
  const [emailDraftId, setEmailDraftId] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailScheduleDraftId, setEmailScheduleDraftId] = useState<string | null>(null);
  const [emailScheduleError, setEmailScheduleError] = useState<string | null>(null);
  const [emailScheduleSuccessId, setEmailScheduleSuccessId] = useState<string | null>(null);
  const [numbersOpenId, setNumbersOpenId] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<{ id: string; message: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<"none" | "dialer" | "calendar" | "dashboard">("none");

  const dispCounts = useMemo(() => {
    const c: Record<string, number> = {};
    leads.forEach((l) => {
      if (l.deleted) return;
      c[l.disposition] = (c[l.disposition] || 0) + 1;
    });
    return c;
  }, [leads]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return leads
      .filter((l) => (showDeleted ? true : !l.deleted))
      .filter((l) => (l.deleted ? true : dispFilter.has(l.disposition)))
      .filter((l) => {
        if (!term) return true;
        const hay = [l.company, l.contact, l.phone, l.email, l.city, l.notes, l.assignedRepName]
          .join(" ")
          .toLowerCase();
        return hay.includes(term);
      })
      .sort((a, b) => a.company.localeCompare(b.company));
  }, [leads, search, dispFilter, showDeleted]);

  async function withBusy<T>(id: string, fn: () => Promise<T>): Promise<T> {
    setBusyId(id);
    try {
      return await fn();
    } finally {
      setBusyId(null);
    }
  }

  async function handleDisposition(l: LeadRecord, value: string) {
    let saleAmount: number | null = null;
    let callbackDate: Date | null = null;
    if (value === "SALE") {
      const input = window.prompt("Sale amount ($):", "");
      if (input === null) return;
      saleAmount = parseFloat(input) || null;
    }
    if (value === "CALLBACK") {
      const input = window.prompt("Callback date (YYYY-MM-DD):", "");
      if (input === null) return;
      callbackDate = input.trim() ? new Date(input.trim()) : null;
    }
    setAssignError(null);
    const result = await withBusy(l.id, () =>
      actions.setDispositionAction(l.id, value as LeadDisposition, saleAmount, callbackDate)
    );
    if (!result.ok && result.error) setAssignError({ id: l.id, message: result.error });
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <input
          type="text"
          placeholder="Search company, contact, phone, notes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm bg-transparent w-64"
        />
        <button
          type="button"
          onClick={() => setShowAddForm((v) => !v)}
          className="bg-green-700 text-white rounded-lg px-3 py-1.5 text-sm font-medium"
        >
          + Add lead
        </button>
        <button
          type="button"
          onClick={() => setOverlay("dialer")}
          className="rounded-lg px-3 py-1.5 text-sm font-medium bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
        >
          ▶ Power Dialer
        </button>
        <button
          type="button"
          onClick={() => setOverlay("calendar")}
          className="rounded-lg px-3 py-1.5 text-sm font-medium bg-amber-600 text-white"
        >
          📅 Callbacks
        </button>
        <button
          type="button"
          onClick={() => setOverlay("dashboard")}
          className="rounded-lg px-3 py-1.5 text-sm font-medium bg-blue-700 text-white"
        >
          📊 Dashboard
        </button>
        <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 ml-auto">
          <input type="checkbox" checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} />
          Show removed
        </label>
      </div>

      {showAddForm && (
        <form
          action={async (fd) => {
            await actions.createLeadAction(fd);
            setShowAddForm(false);
          }}
          className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 mb-4 grid sm:grid-cols-3 gap-2"
        >
          <input type="hidden" name="listKey" value={listKey} />
          <input name="company" placeholder="Company *" required className="border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1.5 text-xs bg-transparent" />
          <input name="contact" placeholder="Contact name" className="border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1.5 text-xs bg-transparent" />
          <input name="phone" placeholder="Phone" className="border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1.5 text-xs bg-transparent" />
          <input name="email" placeholder="Email" className="border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1.5 text-xs bg-transparent" />
          <input name="city" placeholder="City" className="border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1.5 text-xs bg-transparent" />
          <input name="address" placeholder="Address" className="border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1.5 text-xs bg-transparent" />
          <textarea name="notes" placeholder="Notes" className="border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1.5 text-xs bg-transparent sm:col-span-3" />
          <div className="sm:col-span-3 flex gap-2">
            <button type="submit" className="bg-green-700 text-white rounded-lg px-3 py-1.5 text-xs font-medium">
              Save lead
            </button>
            <button type="button" onClick={() => setShowAddForm(false)} className="text-xs text-gray-500 dark:text-gray-400">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="flex flex-wrap gap-1.5 mb-4">
        {LEAD_DISPOSITIONS.map((d) => {
          const n = dispCounts[d] || 0;
          if (!n) return null;
          const active = dispFilter.has(d);
          const meta = DISP_COLORS[d];
          return (
            <button
              key={d}
              type="button"
              onClick={() =>
                setDispFilter((prev) => {
                  const next = new Set(prev);
                  if (next.has(d)) next.delete(d);
                  else next.add(d);
                  return next;
                })
              }
              className="text-[11px] rounded-full px-2.5 py-1 border"
              style={{
                borderColor: meta.color,
                color: active ? "#fff" : meta.color,
                background: active ? meta.color : "transparent",
              }}
            >
              {LEAD_DISPOSITION_LABELS[d]} ({n})
            </button>
          );
        })}
      </div>

      <p className="text-xs text-gray-400 mb-2">{filtered.length} lead{filtered.length === 1 ? "" : "s"}</p>

      <div className="space-y-2">
        {filtered.map((l) => {
          const meta = DISP_COLORS[l.disposition] || DISP_COLORS.NEW;
          const href = telHref(l.phone);
          const isBusy = busyId === l.id;
          return (
            <div
              key={l.id}
              className={`bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 ${l.deleted ? "opacity-50" : ""}`}
            >
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <p className="font-medium text-sm text-gray-900 dark:text-gray-100">{l.company}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{l.contact || ""}</p>
                  {l.assignedRepName && <p className="text-[10px] text-amber-600">rep: {l.assignedRepName}</p>}
                </div>
                <span
                  className="text-[10px] rounded-full px-2 py-0.5 border shrink-0"
                  style={{ borderColor: meta.color, color: meta.color }}
                >
                  {LEAD_DISPOSITION_LABELS[l.disposition as LeadDisposition] ?? l.disposition}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3 mt-2 text-xs">
                {href ? (
                  <a href={href} className="text-green-700 dark:text-green-400 underline font-medium">
                    📞 {fmtPhone(l.phone)}
                  </a>
                ) : (
                  <span className="text-gray-400">{l.phone ? l.phone : "no phone"}</span>
                )}
                {l.email && (
                  <a href={`mailto:${l.email}`} className="text-green-700 dark:text-green-400 underline">
                    ✉ {l.email}
                  </a>
                )}
                {l.website && (
                  <a
                    href={l.website.match(/^https?:\/\//) ? l.website : `https://${l.website}`}
                    target="_blank"
                    rel="noopener"
                    className="text-gray-500 dark:text-gray-400 underline"
                  >
                    🌐 site
                  </a>
                )}
                {(l.address || l.city) && (
                  <span className="text-gray-400">
                    {[l.address, l.city, l.state, l.zip].filter(Boolean).join(", ")}
                  </span>
                )}
              </div>

              {(l.listKey === "mi_processors" || l.listKey === "mi_dispensaries") &&
                (!l.phone || !l.email) &&
                actions.lookupContactAction &&
                actions.applyContactInfoAction && (
                  <div className="mt-1.5">
                    <ContactLookupButton
                      leadId={l.id}
                      lookupAction={actions.lookupContactAction}
                      applyAction={actions.applyContactInfoAction}
                    />
                  </div>
                )}

              {l.notes && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">{l.notes}</p>}
              {(l.license || l.licenseStatus) && (
                <p className="text-[11px] text-gray-400 mt-1">
                  {[l.license, l.licenseType, l.licenseStatus].filter(Boolean).join(" · ")}
                </p>
              )}

              {l.activity.length > 0 && (
                <div className="mt-1.5 pt-1.5 border-t border-gray-100 dark:border-gray-800 space-y-0.5">
                  {l.activity.slice(0, 3).map((a) => (
                    <p key={a.id} className="text-[10.5px] text-gray-400">
                      {new Date(a.createdAt).toLocaleString()}: {a.text}
                    </p>
                  ))}
                </div>
              )}

              {noteDraftId === l.id && (
                <form
                  action={async (fd) => {
                    const text = String(fd.get("note") ?? "").trim();
                    if (!text) return;
                    await withBusy(l.id, () => actions.addNoteAction(l.id, text));
                    setNoteDraftId(null);
                  }}
                  className="mt-2 flex gap-2"
                >
                  <input
                    name="note"
                    autoFocus
                    placeholder="Note…"
                    className="flex-1 border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1 text-xs bg-transparent"
                  />
                  <button type="submit" className="text-xs text-green-700 dark:text-green-400 underline">
                    Save
                  </button>
                  <button type="button" onClick={() => setNoteDraftId(null)} className="text-xs text-gray-400">
                    Cancel
                  </button>
                </form>
              )}

              {textDraftId === l.id && actions.sendTextAction && (
                <form
                  action={async (fd) => {
                    const text = String(fd.get("text") ?? "").trim();
                    if (!text) return;
                    setTextError(null);
                    const result = await withBusy(l.id, () => actions.sendTextAction!(l.id, text));
                    if (result && !result.ok) {
                      setTextError(result.error);
                      return;
                    }
                    setTextDraftId(null);
                  }}
                  className="mt-2 flex gap-2"
                >
                  <input
                    name="text"
                    autoFocus
                    placeholder={`Text ${fmtPhone(l.phone)}…`}
                    className="flex-1 border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1 text-xs bg-transparent"
                  />
                  <button type="submit" className="text-xs text-green-700 dark:text-green-400 underline">
                    Send
                  </button>
                  <button type="button" onClick={() => setTextDraftId(null)} className="text-xs text-gray-400">
                    Cancel
                  </button>
                </form>
              )}
              {textDraftId === l.id && textError && (
                <p className="text-[11px] text-red-600 mt-1">{textError}</p>
              )}

              {scheduleDraftId === l.id && actions.scheduleTextAction && (
                <form
                  action={async (fd) => {
                    const text = String(fd.get("text") ?? "").trim();
                    const when = String(fd.get("when") ?? "");
                    if (!text || !when) return;
                    setScheduleError(null);
                    const result = await withBusy(l.id, () => actions.scheduleTextAction!(l.id, text, new Date(when).toISOString()));
                    if (result && !result.ok) {
                      setScheduleError(result.error);
                      return;
                    }
                    setScheduleDraftId(null);
                    setScheduleSuccessId(l.id);
                  }}
                  className="mt-2 flex flex-col gap-1.5 border border-gray-200 dark:border-gray-800 rounded-lg p-2"
                >
                  <input
                    name="text"
                    autoFocus
                    placeholder={`Text back ${fmtPhone(l.phone)} later…`}
                    className="border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1 text-xs bg-transparent"
                  />
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      type="datetime-local"
                      name="when"
                      defaultValue={defaultScheduleTime()}
                      min={nowForMin()}
                      className="text-xs border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1 bg-transparent"
                    />
                    <button type="submit" className="text-xs text-green-700 dark:text-green-400 underline">
                      Schedule
                    </button>
                    <button type="button" onClick={() => setScheduleDraftId(null)} className="text-xs text-gray-400">
                      Cancel
                    </button>
                  </div>
                </form>
              )}
              {scheduleDraftId === l.id && scheduleError && (
                <p className="text-[11px] text-red-600 mt-1">{scheduleError}</p>
              )}
              {scheduleSuccessId === l.id && (
                <p className="text-[11px] text-green-700 dark:text-green-400 mt-1">Text scheduled.</p>
              )}

              {emailDraftId === l.id && actions.sendEmailAction && (
                <form
                  action={async (fd) => {
                    const subject = String(fd.get("subject") ?? "").trim();
                    const body = String(fd.get("body") ?? "").trim();
                    if (!subject || !body) return;
                    setEmailError(null);
                    const result = await withBusy(l.id, () => actions.sendEmailAction!(l.id, subject, body));
                    if (result && !result.ok) {
                      setEmailError(result.error);
                      return;
                    }
                    setEmailDraftId(null);
                  }}
                  className="mt-2 flex flex-col gap-1.5 border border-gray-200 dark:border-gray-800 rounded-lg p-2"
                >
                  <input
                    name="subject"
                    autoFocus
                    placeholder="Subject"
                    className="border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1 text-xs bg-transparent"
                  />
                  <textarea
                    name="body"
                    rows={3}
                    placeholder={`Email ${l.email ?? ""}…`}
                    className="border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1 text-xs bg-transparent"
                  />
                  <div className="flex items-center gap-2">
                    <button type="submit" className="text-xs text-green-700 dark:text-green-400 underline">
                      Send
                    </button>
                    <button type="button" onClick={() => setEmailDraftId(null)} className="text-xs text-gray-400">
                      Cancel
                    </button>
                  </div>
                </form>
              )}
              {emailDraftId === l.id && emailError && (
                <p className="text-[11px] text-red-600 mt-1">{emailError}</p>
              )}

              {emailScheduleDraftId === l.id && actions.scheduleEmailAction && (
                <form
                  action={async (fd) => {
                    const subject = String(fd.get("subject") ?? "").trim();
                    const body = String(fd.get("body") ?? "").trim();
                    const when = String(fd.get("when") ?? "");
                    if (!subject || !body || !when) return;
                    setEmailScheduleError(null);
                    const result = await withBusy(l.id, () =>
                      actions.scheduleEmailAction!(l.id, subject, body, new Date(when).toISOString())
                    );
                    if (result && !result.ok) {
                      setEmailScheduleError(result.error);
                      return;
                    }
                    setEmailScheduleDraftId(null);
                    setEmailScheduleSuccessId(l.id);
                  }}
                  className="mt-2 flex flex-col gap-1.5 border border-gray-200 dark:border-gray-800 rounded-lg p-2"
                >
                  <input
                    name="subject"
                    autoFocus
                    placeholder="Subject"
                    className="border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1 text-xs bg-transparent"
                  />
                  <textarea
                    name="body"
                    rows={3}
                    placeholder={`Email ${l.email ?? ""} later…`}
                    className="border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1 text-xs bg-transparent"
                  />
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      type="datetime-local"
                      name="when"
                      defaultValue={defaultScheduleTime()}
                      min={nowForMin()}
                      className="text-xs border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1 bg-transparent"
                    />
                    <button type="submit" className="text-xs text-green-700 dark:text-green-400 underline">
                      Schedule
                    </button>
                    <button type="button" onClick={() => setEmailScheduleDraftId(null)} className="text-xs text-gray-400">
                      Cancel
                    </button>
                  </div>
                </form>
              )}
              {emailScheduleDraftId === l.id && emailScheduleError && (
                <p className="text-[11px] text-red-600 mt-1">{emailScheduleError}</p>
              )}
              {emailScheduleSuccessId === l.id && (
                <p className="text-[11px] text-green-700 dark:text-green-400 mt-1">Email scheduled.</p>
              )}

              <button
                type="button"
                onClick={() => setNumbersOpenId(numbersOpenId === l.id ? null : l.id)}
                className="text-[11px] text-gray-500 dark:text-gray-400 underline mt-1"
              >
                {numbersOpenId === l.id ? "Hide phone numbers" : `Phone numbers (${l.phoneNumbers.length})`}
              </button>
              {numbersOpenId === l.id && (
                <LeadPhoneNumbersEditor
                  leadId={l.id}
                  numbers={l.phoneNumbers}
                  actions={{
                    addPhoneNumberAction: actions.addPhoneNumberAction,
                    updatePhoneNumberAction: actions.updatePhoneNumberAction,
                    removePhoneNumberAction: actions.removePhoneNumberAction,
                    setPhoneNumberPositionAction: actions.setPhoneNumberPositionAction,
                  }}
                />
              )}

              {!l.deleted ? (
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={async () => {
                      setAssignError(null);
                      const result = await withBusy(l.id, () => actions.logCallAction(l.id));
                      if (!result.ok && result.error) setAssignError({ id: l.id, message: result.error });
                    }}
                    className="text-[11px] bg-green-700 text-white rounded-lg px-2.5 py-1"
                  >
                    Log call ({l.calledCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setNoteDraftId(l.id)}
                    className="text-[11px] border border-gray-300 dark:border-gray-700 rounded-lg px-2.5 py-1"
                  >
                    + Note
                  </button>
                  {actions.sendTextAction && l.phone && (
                    <button
                      type="button"
                      onClick={() => {
                        setTextError(null);
                        setTextDraftId(l.id);
                      }}
                      className="text-[11px] border border-gray-300 dark:border-gray-700 rounded-lg px-2.5 py-1"
                    >
                      Text
                    </button>
                  )}
                  {actions.scheduleTextAction && l.phone && (
                    <button
                      type="button"
                      onClick={() => {
                        setScheduleError(null);
                        setScheduleSuccessId(null);
                        setScheduleDraftId(l.id);
                      }}
                      className="text-[11px] border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 rounded-lg px-2.5 py-1"
                    >
                      Text back
                    </button>
                  )}
                  {actions.sendEmailAction && l.email && (
                    <button
                      type="button"
                      onClick={() => {
                        setEmailError(null);
                        setEmailDraftId(l.id);
                      }}
                      className="text-[11px] border border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300 rounded-lg px-2.5 py-1"
                    >
                      Email
                    </button>
                  )}
                  {actions.scheduleEmailAction && l.email && (
                    <button
                      type="button"
                      onClick={() => {
                        setEmailScheduleError(null);
                        setEmailScheduleSuccessId(null);
                        setEmailScheduleDraftId(l.id);
                      }}
                      className="text-[11px] border border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300 rounded-lg px-2.5 py-1"
                    >
                      Email later
                    </button>
                  )}
                  <select
                    value={l.disposition}
                    disabled={isBusy}
                    onChange={(e) => handleDisposition(l, e.target.value)}
                    className="text-[11px] border border-gray-300 dark:border-gray-700 rounded-lg px-1.5 py-1 bg-transparent"
                  >
                    {LEAD_DISPOSITIONS.map((d) => (
                      <option key={d} value={d}>
                        {LEAD_DISPOSITION_LABELS[d]}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setEditingId(editingId === l.id ? null : l.id)}
                    className="text-[11px] text-gray-500 dark:text-gray-400 underline"
                  >
                    {editingId === l.id ? "Close" : "Edit"}
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => withBusy(l.id, () => actions.deleteLeadAction(l.id))}
                    className="text-[11px] text-red-500 underline ml-auto"
                  >
                    Remove
                  </button>
                </div>
              ) : null}
              {assignError?.id === l.id && (
                <p className="text-[11px] text-red-600 mt-1">{assignError.message}</p>
              )}
              {l.deleted && (
                <div className="mt-2">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => withBusy(l.id, () => actions.restoreLeadAction(l.id))}
                    className="text-[11px] text-green-700 underline"
                  >
                    Restore
                  </button>
                </div>
              )}

              {editingId === l.id && (
                <form
                  action={async (fd) => {
                    await withBusy(l.id, () =>
                      actions.updateLeadAction(l.id, {
                        company: String(fd.get("company") ?? ""),
                        contact: String(fd.get("contact") ?? ""),
                        phone: String(fd.get("phone") ?? ""),
                        altPhone: String(fd.get("altPhone") ?? ""),
                        email: String(fd.get("email") ?? ""),
                        website: String(fd.get("website") ?? ""),
                        address: String(fd.get("address") ?? ""),
                        city: String(fd.get("city") ?? ""),
                        state: String(fd.get("state") ?? ""),
                        zip: String(fd.get("zip") ?? ""),
                        notes: String(fd.get("notes") ?? ""),
                        assignedRepName: String(fd.get("assignedRepName") ?? ""),
                      })
                    );
                    setEditingId(null);
                  }}
                  className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800 grid sm:grid-cols-3 gap-2"
                >
                  <input name="company" defaultValue={l.company} placeholder="Company" className="border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1 text-xs bg-transparent" />
                  <input name="contact" defaultValue={l.contact || ""} placeholder="Contact" className="border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1 text-xs bg-transparent" />
                  <input name="assignedRepName" defaultValue={l.assignedRepName || ""} placeholder="Assigned rep" className="border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1 text-xs bg-transparent" />
                  <input name="phone" defaultValue={l.phone || ""} placeholder="Phone" className="border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1 text-xs bg-transparent" />
                  <input name="altPhone" defaultValue={l.altPhone || ""} placeholder="Alt phone" className="border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1 text-xs bg-transparent" />
                  <input name="email" defaultValue={l.email || ""} placeholder="Email" className="border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1 text-xs bg-transparent" />
                  <input name="website" defaultValue={l.website || ""} placeholder="Website" className="border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1 text-xs bg-transparent" />
                  <input name="address" defaultValue={l.address || ""} placeholder="Address" className="border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1 text-xs bg-transparent" />
                  <input name="city" defaultValue={l.city || ""} placeholder="City" className="border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1 text-xs bg-transparent" />
                  <input name="state" defaultValue={l.state || ""} placeholder="State" className="border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1 text-xs bg-transparent" />
                  <input name="zip" defaultValue={l.zip || ""} placeholder="Zip" className="border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1 text-xs bg-transparent" />
                  <textarea name="notes" defaultValue={l.notes || ""} placeholder="Notes" className="border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1 text-xs bg-transparent sm:col-span-3" />
                  <div className="sm:col-span-3 flex gap-2">
                    <button type="submit" className="bg-green-700 text-white rounded-lg px-3 py-1.5 text-xs font-medium">
                      Save changes
                    </button>
                  </div>
                </form>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">No leads match.</p>
        )}
      </div>

      {overlay === "dialer" && (
        <PowerDialer
          leads={leads}
          actions={{
            setDispositionAction: actions.setDispositionAction,
            logCallAction: actions.logCallAction,
            addNoteAction: actions.addNoteAction,
          }}
          onClose={() => setOverlay("none")}
        />
      )}
      {overlay === "calendar" && <CallbackCalendar leads={leads} onClose={() => setOverlay("none")} />}
      {overlay === "dashboard" && <LeadDashboard leads={leads} onClose={() => setOverlay("none")} />}
    </div>
  );
}
