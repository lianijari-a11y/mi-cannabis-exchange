import { type ReactNode } from "react";

// The status-pill pattern (license status, order status, METRC submission
// status, etc.) is ad hoc everywhere today. See CLAUDE.md §26 — existing
// call sites are untouched (Phase 2).
const TONES = {
  neutral: "bg-surface-muted text-ink-muted",
  success: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  danger: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
} as const;

export function Badge({ tone = "neutral", children }: { tone?: keyof typeof TONES; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center text-[10px] uppercase tracking-wide font-medium px-2 py-0.5 rounded-full ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}
