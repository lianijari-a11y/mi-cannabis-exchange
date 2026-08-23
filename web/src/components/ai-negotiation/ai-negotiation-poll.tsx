"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const POLL_INTERVAL_MS = 6000;

// Mirrors components/retailer/pos/live-refresh.tsx's polling pattern. An
// AI-submitted round never re-triggers another automated step by itself
// (see lib/offers.ts's aiGenerated gate on addOfferRound's end-of-function
// hook) — that's what keeps an AI-vs-AI thread from resolving in one
// instant synchronous chain. This poll is what lets it keep advancing
// anyway, one visible step at a time, only while this page is actually
// open and visible to watch it happen.
export function AiNegotiationPoll({ pollAction }: { pollAction: () => Promise<void> }) {
  const router = useRouter();
  const pollingRef = useRef(false);

  useEffect(() => {
    async function tick() {
      if (document.hidden || pollingRef.current) return;
      pollingRef.current = true;
      try {
        await pollAction();
        router.refresh();
      } finally {
        pollingRef.current = false;
      }
    }
    const id = setInterval(tick, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [pollAction, router]);

  return null;
}
