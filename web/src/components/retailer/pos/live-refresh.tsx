"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// Cross-terminal / cross-location sync (CLAUDE.md's POS hardening plan,
// Phase 1) — Inventory/Orders/Intake are server-rendered props, so a
// terminal only saw another terminal's sale on its next manual navigation.
// Phase 0's atomically-guarded decrement already makes a stale read
// harmless (a sold-out item just fails cleanly at checkout), so this is
// purely a UX latency fix, not a correctness one: router.refresh() re-runs
// the page's server fetch on an interval, updating props for every panel
// while RegisterPanel's own client-side cart state is untouched (its
// component identity never remounts across a refresh). Paused when the tab
// isn't visible so backgrounded terminals don't add load for nothing.
export function LiveRefresh({ intervalMs = 4000 }: { intervalMs?: number }) {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    function start() {
      if (timerRef.current) return;
      timerRef.current = setInterval(() => router.refresh(), intervalMs);
    }
    function stop() {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    function onVisibilityChange() {
      if (document.visibilityState === "visible") start();
      else stop();
    }

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [router, intervalMs]);

  return null;
}
