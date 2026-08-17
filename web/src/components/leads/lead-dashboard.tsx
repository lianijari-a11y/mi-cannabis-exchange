"use client";

import { useMemo } from "react";
import { LEAD_DISPOSITIONS, LEAD_DISPOSITION_LABELS } from "@/lib/leads-constants";
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

function toDateStr(v: string | Date | null): string | null {
  if (!v) return null;
  const d = typeof v === "string" ? new Date(v) : v;
  if (isNaN(d.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function LeadDashboard({ leads, onClose }: { leads: LeadRecord[]; onClose: () => void }) {
  const stats = useMemo(() => {
    const active = leads.filter((l) => !l.deleted);
    const total = active.length;
    const today = toDateStr(new Date())!;
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = toDateStr(weekAgo)!;

    const callsToday = active.filter((l) => (toDateStr(l.lastCallAt) ?? "") === today).length;
    const callsWeek = active.filter((l) => (toDateStr(l.lastCallAt) ?? "") >= weekAgoStr).length;

    const dispCounts: Record<string, number> = {};
    LEAD_DISPOSITIONS.forEach((k) => (dispCounts[k] = 0));
    let salesTotal = 0;
    let salesCount = 0;
    active.forEach((l) => {
      const disp = l.disposition || "NEW";
      dispCounts[disp] = (dispCounts[disp] || 0) + 1;
      if (disp === "SALE") {
        salesCount++;
        if (l.saleAmount != null) salesTotal += l.saleAmount;
      }
    });

    const contacted = active.filter((l) => (l.calledCount || 0) > 0).length;
    const conversion = contacted ? ((salesCount / contacted) * 100).toFixed(1) : "0.0";

    const repCounts: Record<string, { calls: number; sales: number }> = {};
    active.forEach((l) => {
      if (l.assignedRepName) {
        const r = repCounts[l.assignedRepName] || { calls: 0, sales: 0 };
        r.calls += l.calledCount || 0;
        if (l.disposition === "SALE") r.sales++;
        repCounts[l.assignedRepName] = r;
      }
    });
    const repRows = Object.entries(repCounts).sort((a, b) => b[1].calls - a[1].calls);

    return { total, callsToday, callsWeek, dispCounts, salesCount, salesTotal, conversion, repRows };
  }, [leads]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-auto" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 max-w-lg w-full my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">📊 Dashboard</h2>
          <button className="text-xs text-gray-400" onClick={onClose}>Close</button>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { n: stats.total, l: "Total records" },
            { n: stats.callsToday, l: "Calls today" },
            { n: stats.callsWeek, l: "Calls this week" },
            { n: stats.salesCount, l: "Sales closed" },
            { n: `$${stats.salesTotal.toLocaleString()}`, l: "Total sale $" },
            { n: `${stats.conversion}%`, l: "Conversion" },
          ].map((s) => (
            <div key={s.l} className="border border-gray-200 dark:border-gray-800 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-green-700 dark:text-green-400">{s.n}</div>
              <div className="text-[9px] uppercase text-gray-400">{s.l}</div>
            </div>
          ))}
        </div>

        <p className="text-[11px] uppercase text-gray-400 mb-1.5">By disposition</p>
        <div className="mb-4">
          {LEAD_DISPOSITIONS.map((k) => {
            const n = stats.dispCounts[k] || 0;
            if (!n) return null;
            return (
              <div key={k} className="flex items-center gap-2 text-xs py-1 border-b border-gray-100 dark:border-gray-800">
                <span className="w-2 h-2 rounded-full inline-block" style={{ background: DISP_COLORS[k] }} />
                {LEAD_DISPOSITION_LABELS[k]}
                <span className="ml-auto text-gray-400">{n}</span>
              </div>
            );
          })}
        </div>

        {stats.repRows.length > 0 && (
          <>
            <p className="text-[11px] uppercase text-gray-400 mb-1.5">By rep</p>
            <div>
              {stats.repRows.map(([rep, c]) => (
                <div key={rep} className="flex items-center gap-2 text-xs py-1 border-b border-gray-100 dark:border-gray-800">
                  {rep}
                  <span className="ml-auto text-gray-400">{c.calls} calls · {c.sales} sales</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
