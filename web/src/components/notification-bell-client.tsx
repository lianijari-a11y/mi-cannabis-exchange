"use client";

import { useState, useTransition } from "react";
import { Bell } from "lucide-react";
import { markNotificationsRead } from "@/app/actions";
import { Card } from "@/components/ui/card";

type NotificationItem = {
  id: string;
  message: string;
  read: boolean;
  createdAt: Date | string;
};

function timeAgo(ts: Date | string) {
  const ms = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function NotificationBellClient({
  notifications,
  unreadCount,
}: {
  notifications: NotificationItem[];
  unreadCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [dismissedCount, setDismissedCount] = useState(0);
  const [, startTransition] = useTransition();

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unreadCount > dismissedCount) {
      setDismissedCount(unreadCount);
      startTransition(() => {
        markNotificationsRead();
      });
    }
  }

  const badgeCount = Math.max(unreadCount - dismissedCount, 0);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        className="relative text-ink-muted hover:text-ink transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4" />
        {badgeCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-red-600 text-white text-[9px] font-bold rounded-full min-w-[15px] h-[15px] flex items-center justify-center px-0.5 ring-2 ring-white dark:ring-gray-950">
            {badgeCount}
          </span>
        )}
      </button>
      {open && (
        <Card className="absolute top-8 right-0 w-72 max-h-96 overflow-y-auto shadow-elevated z-50">
          {notifications.length === 0 ? (
            <p className="p-4 text-xs text-ink-faint text-center">No notifications yet.</p>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`p-3 text-xs border-b border-border last:border-0 ${
                  n.read ? "" : "bg-primary-tint"
                }`}
              >
                <p className="text-ink-muted">{n.message}</p>
                <p className="text-[10px] text-ink-faint mt-1">{timeAgo(n.createdAt)}</p>
              </div>
            ))
          )}
        </Card>
      )}
    </div>
  );
}
