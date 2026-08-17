"use client";

import { useMemo, useState } from "react";
import type { LeadRecord } from "./leads-manager";

function digitsOnly(s: string | null) {
  return (s || "").replace(/\D/g, "");
}
function telHref(phone: string | null) {
  const d = digitsOnly(phone);
  if (d.length < 10) return null;
  return "tel:+1" + d.slice(-10);
}
function toDateStr(v: string | Date | null): string | null {
  if (!v) return null;
  const d = typeof v === "string" ? new Date(v) : v;
  if (isNaN(d.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function todayStr() {
  return toDateStr(new Date())!;
}
function gcalLink(title: string, dateStr: string, details: string) {
  const start = dateStr.replace(/-/g, "");
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + 1);
  const end = toDateStr(d)!.replace(/-/g, "");
  return (
    "https://www.google.com/calendar/render?action=TEMPLATE&text=" +
    encodeURIComponent(title) +
    "&dates=" +
    start +
    "/" +
    end +
    "&details=" +
    encodeURIComponent(details)
  );
}

function CalItem({ lead, dateStr }: { lead: LeadRecord; dateStr: string }) {
  const href = telHref(lead.phone);
  const gcal = gcalLink("Callback: " + (lead.company || ""), dateStr, "Contact: " + (lead.contact || "") + " " + (lead.phone || ""));
  return (
    <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-2 mb-1.5">
      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{lead.company || ""}</p>
      <p className="text-[11px] text-gray-400">
        {dateStr}
        {href && (
          <>
            {" · "}
            <a className="text-green-700 dark:text-green-400 underline" href={href}>
              {lead.phone}
            </a>
          </>
        )}
      </p>
      <a className="text-[11px] text-green-700 dark:text-green-400 inline-block mt-0.5" href={gcal} target="_blank" rel="noopener">
        + Add to Google Calendar
      </a>
    </div>
  );
}

export function CallbackCalendar({ leads, onClose }: { leads: LeadRecord[]; onClose: () => void }) {
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const withCallback = useMemo(
    () =>
      leads
        .filter((l) => !l.deleted && l.callbackDate)
        .map((l) => ({ lead: l, dateStr: toDateStr(l.callbackDate) }))
        .filter((x): x is { lead: LeadRecord; dateStr: string } => !!x.dateStr),
    [leads]
  );

  const byDate = useMemo(() => {
    const m: Record<string, { lead: LeadRecord; dateStr: string }[]> = {};
    withCallback.forEach((x) => {
      (m[x.dateStr] = m[x.dateStr] || []).push(x);
    });
    return m;
  }, [withCallback]);

  const today = todayStr();
  const base = new Date();
  base.setDate(1);
  base.setMonth(base.getMonth() + monthOffset);
  const year = base.getFullYear();
  const month = base.getMonth();
  const monthLabel = base.toLocaleString("default", { month: "long", year: "numeric" });
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (string | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  }

  const overdue = withCallback.filter((x) => x.dateStr < today).sort((a, b) => a.dateStr.localeCompare(b.dateStr));
  const upcoming = withCallback.filter((x) => x.dateStr >= today).sort((a, b) => a.dateStr.localeCompare(b.dateStr));
  const selected = selectedDate ? byDate[selectedDate] || [] : null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-auto" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 max-w-lg w-full my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">📅 Callback Calendar</h2>
          <button className="text-xs text-gray-400" onClick={onClose}>Close</button>
        </div>
        <div className="flex items-center justify-center gap-3 mb-3">
          <button className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-700" onClick={() => setMonthOffset((n) => n - 1)}>
            ←
          </button>
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 min-w-[130px] text-center">{monthLabel}</span>
          <button className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-700" onClick={() => setMonthOffset((n) => n + 1)}>
            →
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 mb-1">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="text-[9px] uppercase text-gray-400 text-center">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1 mb-4">
          {cells.map((dateStr, i) => {
            if (!dateStr) return <div key={i} />;
            const items = byDate[dateStr] || [];
            const isToday = dateStr === today;
            const isOverdue = items.length > 0 && dateStr < today;
            return (
              <button
                key={dateStr}
                onClick={() => setSelectedDate(dateStr)}
                className={`aspect-square border rounded-md p-1 text-left relative ${
                  isToday ? "border-green-600 border-2" : "border-gray-200 dark:border-gray-800"
                } ${isOverdue ? "bg-red-50 dark:bg-red-900/20" : ""}`}
              >
                <span className="text-[10px] text-gray-700 dark:text-gray-300">{parseInt(dateStr.slice(-2), 10)}</span>
                {items.length > 0 && (
                  <span className="absolute bottom-0.5 right-0.5 bg-amber-600 text-white text-[8px] w-3.5 h-3.5 rounded-full flex items-center justify-center">
                    {items.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="max-h-64 overflow-auto">
          {selected ? (
            <>
              <p className="text-[11px] uppercase text-gray-400 mb-1.5">{selectedDate} ({selected.length})</p>
              {selected.length ? selected.map((x) => <CalItem key={x.lead.id} lead={x.lead} dateStr={x.dateStr} />) : (
                <p className="text-xs text-gray-400 py-3">No callbacks this day.</p>
              )}
              <button className="text-xs text-gray-400 underline mt-1" onClick={() => setSelectedDate(null)}>
                ← Back to overview
              </button>
            </>
          ) : (
            <>
              {overdue.length > 0 && (
                <>
                  <p className="text-[11px] uppercase text-red-500 mb-1.5">Overdue ({overdue.length})</p>
                  {overdue.map((x) => <CalItem key={x.lead.id} lead={x.lead} dateStr={x.dateStr} />)}
                </>
              )}
              <p className="text-[11px] uppercase text-gray-400 mb-1.5 mt-2">Upcoming</p>
              {upcoming.length ? upcoming.map((x) => <CalItem key={x.lead.id} lead={x.lead} dateStr={x.dateStr} />) : (
                <p className="text-xs text-gray-400 py-3">No upcoming callbacks scheduled.</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
