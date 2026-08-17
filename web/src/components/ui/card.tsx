import { type ReactNode, type HTMLAttributes } from "react";

// The card-shell pattern (bg-white dark:bg-gray-900 border border-gray-200
// dark:border-gray-800 rounded-xl) recurs literally across 50+ files today
// — this is the shared version new/updated call sites should reach for
// instead. See CLAUDE.md §26 — existing call sites are untouched (Phase 2).
export function Card({
  children,
  interactive = false,
  className = "",
  ...rest
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode; interactive?: boolean }) {
  return (
    <div
      className={`bg-surface border border-border rounded-xl shadow-card ${
        interactive ? "transition-all hover:shadow-elevated hover:border-primary/30" : ""
      } ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
