"use client";

import { useMemo, useState } from "react";
import { LEAD_DISPOSITIONS, LEAD_DISPOSITION_LABELS, type LeadDisposition } from "@/lib/leads-constants";
import type { LeadRecord } from "./leads-manager";

const DISP_COLORS: Record<string, string> = {
  NEW: "#6b7c93",
  NO_PHONE: "#b8860b",
  NO_ANSWER: "#8a6d3b",
  BUSY: "#6b5ca8",
  CALLBACK: "#a8763e",
  EMAIL_SENT: "#3b6ea5",
  SALE: "#2f5d4f",
  DISCONNECTED: "#8a6d3b",
  DECLINED: "#a84432",
  DNC: "#a84432",
};

const DIALER_DISPOSITIONS: LeadDisposition[] = ["NO_ANSWER", "BUSY", "CALLBACK", "EMAIL_SENT", "SALE", "DISCONNECTED", "DNC"];

function digitsOnly(s: string | null) {
  return (s || "").replace(/\D/g, "");
}
function telHref(phone: string | null) {
  const d = digitsOnly(phone);
  if (d.length < 10) return null;
  return "tel:+1" + d.slice(-10);
}
function fmtPhone(phone: string | null) {
  const d = digitsOnly(phone);
  if (d.length < 10) return phone || "—";
  const last10 = d.slice(-10);
  return `(${last10.slice(0, 3)}) ${last10.slice(3, 6)}-${last10.slice(6)}`;
}

export function PowerDialer({
  leads,
  actions,
  onClose,
}: {
  leads: LeadRecord[];
  actions: {
    setDispositionAction: (
      id: string,
      disposition: LeadDisposition,
      saleAmount?: number | null,
      callbackDate?: Date | null
    ) => Promise<void>;
    logCallAction: (id: string) => Promise<void>;
    addNoteAction: (id: string, text: string) => Promise<void>;
  };
  onClose: () => void;
}) {
  const dialable = useMemo(
    () => leads.filter((l) => !l.deleted && digitsOnly(l.phone).length >= 10),
    [leads]
  );
  const countsByDisp = useMemo(() => {
    const c: Record<string, number> = {};
    dialable.forEach((l) => { c[l.disposition] = (c[l.disposition] || 0) + 1; });
    return c;
  }, [dialable]);

  const [stage, setStage] = useState<"setup" | "dialing">("setup");
  const [chosen, setChosen] = useState<Set<string>>(new Set(["NEW", "NO_ANSWER", "BUSY"]));
  const [queue, setQueue] = useState<LeadRecord[]>([]);
  const [index, setIndex] = useState(0);
  const [sessionCount, setSessionCount] = useState(0);
  const [noteDraft, setNoteDraft] = useState("");
  const [busy, setBusy] = useState(false);

  function startDialing() {
    const q = dialable
      .filter((l) => chosen.has(l.disposition))
      .sort((a, b) => (a.company || "").toLowerCase().localeCompare((b.company || "").toLowerCase()));
    setQueue(q);
    setIndex(0);
    setSessionCount(0);
    setStage("dialing");
  }

  async function handleDisposition(value: LeadDisposition) {
    const lead = queue[index];
    if (!lead) return;
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
    setBusy(true);
    try {
      if (noteDraft.trim()) await actions.addNoteAction(lead.id, noteDraft.trim());
      await actions.logCallAction(lead.id);
      await actions.setDispositionAction(lead.id, value, saleAmount, callbackDate);
    } finally {
      setBusy(false);
    }
    setSessionCount((n) => n + 1);
    setNoteDraft("");
    setIndex((i) => i + 1);
  }

  async function saveNoteOnly() {
    const lead = queue[index];
    if (!lead || !noteDraft.trim()) return;
    setBusy(true);
    try {
      await actions.addNoteAction(lead.id, noteDraft.trim());
    } finally {
      setBusy(false);
    }
    setNoteDraft("");
  }

  const backdrop = "fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-auto";
  const card = "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 max-w-md w-full my-auto";

  if (stage === "setup") {
    return (
      <div className={backdrop} onClick={onClose}>
        <div className={card} onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">▶ Start Power Dialer</h2>
            <button className="text-xs text-gray-400" onClick={onClose}>Close</button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            Pick which dispositions to dial. Only leads with a phone number are included.
          </p>
          <div className="space-y-1.5 mb-4 max-h-64 overflow-auto">
            {LEAD_DISPOSITIONS.map((k) => {
              const n = countsByDisp[k] || 0;
              return (
                <label key={k} className={`flex items-center gap-2 text-sm py-1 ${n === 0 ? "text-gray-400" : "text-gray-700 dark:text-gray-300"}`}>
                  <input
                    type="checkbox"
                    disabled={n === 0}
                    checked={chosen.has(k)}
                    onChange={(e) => {
                      setChosen((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(k); else next.delete(k);
                        return next;
                      });
                    }}
                  />
                  <span className="w-2 h-2 rounded-full inline-block" style={{ background: DISP_COLORS[k] }} />
                  {LEAD_DISPOSITION_LABELS[k]} ({n})
                </label>
              );
            })}
          </div>
          <div className="flex justify-end gap-2">
            <button className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-500" onClick={onClose}>
              Cancel
            </button>
            <button
              className="text-xs px-3 py-1.5 rounded-lg bg-green-700 text-white font-medium"
              onClick={startDialing}
              disabled={chosen.size === 0}
            >
              Start Dialing
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (index >= queue.length) {
    return (
      <div className={backdrop} onClick={onClose}>
        <div className={card} onClick={(e) => e.stopPropagation()}>
          <p className="text-sm text-gray-700 dark:text-gray-300 text-center py-6">
            🎉 Done! You dispositioned {sessionCount} of {queue.length} leads this session.
          </p>
          <button className="w-full text-xs px-3 py-2 rounded-lg bg-green-700 text-white font-medium" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    );
  }

  const lead = queue[index];
  const href = telHref(lead.phone);
  const recentLog = (lead.activity || []).slice(0, 3);

  return (
    <div className={backdrop} onClick={onClose}>
      <div className={card} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">▶ Power Dialer</h2>
          <button className="text-xs text-gray-400" onClick={onClose}>Exit</button>
        </div>
        <p className="text-[11px] text-gray-400 text-center mb-1">
          Lead {index + 1} of {queue.length} · {sessionCount} dispositioned this session
        </p>
        <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 text-center">{lead.company || "(no company)"}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center mb-3">{lead.contact || ""}</p>
        {href ? (
          <a
            className="block text-center text-xl font-bold text-white bg-green-700 rounded-lg py-3 mb-3"
            href={href}
          >
            📞 {fmtPhone(lead.phone)}
          </a>
        ) : (
          <p className="text-center text-sm text-gray-400 mb-3">no phone</p>
        )}
        {lead.email && (
          <a className="block text-center text-xs text-green-700 dark:text-green-400 underline mb-3" href={`mailto:${lead.email}`}>
            ✉ {lead.email}
          </a>
        )}
        {lead.notes && (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 text-xs text-gray-500 dark:text-gray-400 mb-3">{lead.notes}</div>
        )}
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900 rounded-lg p-2 mb-3">
          <label className="text-[10px] uppercase text-gray-400 block mb-1">Add a note</label>
          <textarea
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            placeholder="Type notes while you're on the call…"
            className="w-full text-xs border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-transparent mb-1.5"
            rows={2}
          />
          <button disabled={busy || !noteDraft.trim()} onClick={saveNoteOnly} className="text-[11px] bg-green-700 text-white rounded-lg px-2.5 py-1">
            💾 Save Note
          </button>
          {recentLog.length > 0 && (
            <div className="mt-1.5 pt-1.5 border-t border-amber-200 dark:border-amber-900 space-y-0.5">
              {recentLog.map((a) => (
                <p key={a.id} className="text-[10px] text-gray-400">
                  {new Date(a.createdAt).toLocaleString()}: {a.text}
                </p>
              ))}
            </div>
          )}
        </div>
        <div className="grid grid-cols-3 gap-1.5 mb-3">
          {DIALER_DISPOSITIONS.map((d) => (
            <button
              key={d}
              disabled={busy}
              onClick={() => handleDisposition(d)}
              className="text-xs rounded-lg border-2 py-2"
              style={{ borderColor: DISP_COLORS[d] }}
            >
              {LEAD_DISPOSITION_LABELS[d]}
            </button>
          ))}
        </div>
        <div className="flex justify-center gap-3">
          <button disabled={busy} className="text-xs text-gray-400 underline" onClick={() => { setNoteDraft(""); setIndex((i) => i + 1); }}>
            Skip →
          </button>
          <button className="text-xs text-gray-400 underline" onClick={onClose}>
            Exit dialer
          </button>
        </div>
      </div>
    </div>
  );
}
