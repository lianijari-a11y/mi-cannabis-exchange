import { type ButtonHTMLAttributes } from "react";

// Replaces the `bg-green-700 text-white rounded-lg px-3 py-1.5 text-xs
// font-medium` string (and its secondary/destructive/ghost cousins)
// repeated across dozens of files. See CLAUDE.md §26 — existing call sites
// are untouched (Phase 2).
const VARIANTS = {
  primary: "bg-primary hover:bg-primary-hover text-white",
  secondary:
    "border border-border text-ink hover:bg-surface-muted",
  destructive: "border border-red-300 dark:border-red-800 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30",
  ghost: "text-ink-muted hover:text-ink hover:bg-surface-muted",
} as const;

const SIZES = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
} as const;

export function Button({
  variant = "primary",
  size = "sm",
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
}) {
  return (
    <button
      className={`rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    />
  );
}
