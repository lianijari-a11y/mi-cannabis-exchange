"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type CampaignItem = { id: string; status: string; lead: { company: string } };
export type CampaignRecord = {
  id: string;
  channel: string;
  subject: string | null;
  templateText: string;
  personalized: boolean;
  scheduledFor: Date | string | null;
  status: string;
  createdAt: Date | string;
  sentAt: Date | string | null;
  canceledAt: Date | string | null;
  items: CampaignItem[];
};

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Scheduled",
  sending: "Sending",
  sent: "Done",
  canceled: "Canceled",
};

const ITEM_STATUS_LABEL: Record<string, string> = {
  pending: "pending",
  sent: "sent",
  failed: "failed",
  skipped_dnc: "skipped — DNC",
  skipped_blocked: "skipped — blocked",
  skipped_unsubscribed: "skipped — unsubscribed",
  skipped_claimed: "skipped — reassigned",
  canceled: "canceled",
};

function fmt(d: Date | string | null): string | null {
  if (!d) return null;
  return new Date(d).toLocaleString();
}

export function CampaignList({
  campaigns,
  cancelAction,
}: {
  campaigns: CampaignRecord[];
  cancelAction: (campaignId: string) => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const router = useRouter();

  if (campaigns.length === 0) {
    return <p className="text-xs text-gray-500 dark:text-gray-400">No message campaigns yet.</p>;
  }

  return (
    <div className="space-y-3">
      {campaigns.map((c) => {
        const itemCounts = c.items.reduce<Record<string, number>>((acc, i) => {
          acc[i.status] = (acc[i.status] ?? 0) + 1;
          return acc;
        }, {});
        return (
          <div key={c.id} className="rounded-lg border border-gray-200 dark:border-gray-800 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="text-xs font-medium text-gray-900 dark:text-gray-100">
                  {STATUS_LABEL[c.status] ?? c.status}
                </span>
                <span
                  className={`text-[10px] rounded-full px-1.5 py-0.5 ml-2 ${
                    c.channel === "email"
                      ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                      : "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                  }`}
                >
                  {c.channel === "email" ? "Email" : "Text"}
                </span>
                <span className="text-[11px] text-gray-500 dark:text-gray-400 ml-2">
                  {c.items.length} message{c.items.length === 1 ? "" : "s"}
                  {!c.personalized && " · plain template"}
                </span>
              </div>
              {c.status === "scheduled" && (
                <button
                  type="button"
                  disabled={isPending && busyId === c.id}
                  onClick={() => {
                    setBusyId(c.id);
                    startTransition(async () => {
                      await cancelAction(c.id);
                      router.refresh();
                    });
                  }}
                  className="text-[11px] text-red-600 dark:text-red-400 shrink-0"
                >
                  Cancel
                </button>
              )}
            </div>
            {c.subject && <p className="text-xs font-medium text-gray-900 dark:text-gray-100">{c.subject}</p>}
            <p className="text-xs text-gray-700 dark:text-gray-300 line-clamp-2">{c.templateText}</p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              {c.scheduledFor ? `Scheduled for ${fmt(c.scheduledFor)}` : "Sent as soon as possible"}
              {c.sentAt && ` · finished ${fmt(c.sentAt)}`}
              {c.canceledAt && ` · canceled ${fmt(c.canceledAt)}`}
            </p>
            <div className="flex gap-1.5 flex-wrap">
              {Object.entries(itemCounts).map(([status, n]) => (
                <span
                  key={status}
                  className="text-[10px] rounded-full border border-gray-300 dark:border-gray-700 px-2 py-0.5 text-gray-600 dark:text-gray-300"
                >
                  {ITEM_STATUS_LABEL[status] ?? status}: {n}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
