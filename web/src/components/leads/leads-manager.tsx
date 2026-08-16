"use client";

import { useMemo, useState } from "react";
import {
  LEAD_DISPOSITIONS,
  LEAD_DISPOSITION_LABELS,
  type LeadDisposition,
  type LeadListKey,
} from "@/lib/leads-constants";

type LeadActivity = { id: string; text: string; createdAt: string | Date };

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

export function LeadsManager({
  leads,
  listKey,
  actions,
}: {
  leads: LeadRecord[];
  listKey: LeadListKey;
  actions: {
    createLeadAction: (formData: FormData) => Promise<void>;
    setDispositionAction: (
      id: string,
      disposition: LeadDisposition,
      saleAmount?: number | null,
      callbackDate?: Date | null
    ) => Promise<void>;
    logCallAction: (id: string) => Promise<void>;
    addNoteAction: (id: string, text: string) => Promise<void>;
    deleteLeadAction: (id: string) => Promise<void>;
    restoreLeadAction: (id: string) => Promise<void>;
    updateLeadAction: (id: string, fields: Record<string, unknown>) => Promise<void>;
  };
}) {
  const [search, setSearch] = useState("");
  const [dispFilter, setDispFilter] = useState<Set<string>>(new Set(LEAD_DISPOSITIONS));
  const [showDeleted, setShowDeleted] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [noteDraftId, setNoteDraftId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

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

  async function withBusy(id: string, fn: () => Promise<void>) {
    setBusyId(id);
    try {
      await fn();
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
    await withBusy(l.id, () => actions.setDispositionAction(l.id, value as LeadDisposition, saleAmount, callbackDate));
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

              {!l.deleted ? (
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => withBusy(l.id, () => actions.logCallAction(l.id))}
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
              ) : (
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
    </div>
  );
}
