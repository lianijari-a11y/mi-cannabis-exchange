"use client";

import { useState } from "react";

type Mandate = {
  openingPrice: number;
  walkAwayPrice: number;
  roundsUsed: number;
  maxRounds: number;
  active: boolean;
};

// Opt-in / status / take-back-control panel for one party's own
// AI-negotiation mandate on one thread. See lib/ai-negotiation.ts for the
// engine this drives. Deliberately never shows or lets a party set the
// *other* side's mandate — that would leak their private negotiating
// range, exactly the anonymization-boundary discipline
// threadsForRetailer/threadsForSeller already apply to this data.
export function AiMandatePanel({
  partyRole,
  mandate,
  needsBrokerMediation,
  optInAction,
  takeBackAction,
  threadId,
  listingId,
  defaultPrice,
}: {
  partyRole: "retailer" | "seller";
  mandate?: Mandate | null;
  needsBrokerMediation: boolean;
  optInAction: (formData: FormData) => void;
  takeBackAction: (formData: FormData) => void;
  threadId: string;
  listingId: string;
  defaultPrice: number;
}) {
  const [open, setOpen] = useState(false);

  if (needsBrokerMediation) {
    return (
      <div className="mb-2 text-xs bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2 text-blue-800 dark:text-blue-300">
        AI couldn&apos;t reach a deal within the approved range — a Broker is now helping finish
        this negotiation.
      </div>
    );
  }

  if (mandate?.active) {
    const directionLabel = partyRole === "retailer" ? "up to" : "down to";
    return (
      <div className="mb-2 text-xs bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2">
        <p className="text-green-800 dark:text-green-300 flex items-center gap-1">
          <span className="text-[9px] font-semibold uppercase tracking-wide bg-green-700 text-white px-1.5 py-0.5 rounded-full">
            AI
          </span>
          Negotiating for you — opened at ${mandate.openingPrice}, will go {directionLabel} $
          {mandate.walkAwayPrice} ({mandate.roundsUsed}/{mandate.maxRounds} rounds used).
        </p>
        <form action={takeBackAction} className="mt-1">
          <input type="hidden" name="threadId" value={threadId} />
          <input type="hidden" name="listingId" value={listingId} />
          <button type="submit" className="text-green-700 dark:text-green-400 underline font-medium">
            Take back control
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="mb-2">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs text-gray-500 dark:text-gray-400 underline"
        >
          Let AI negotiate for me
        </button>
      ) : (
        <form
          action={optInAction}
          className="text-xs bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-3 space-y-2"
        >
          <input type="hidden" name="threadId" value={threadId} />
          <input type="hidden" name="listingId" value={listingId} />
          <p className="text-gray-500 dark:text-gray-400">
            Give AI a real price range and it will submit real counter-offers on your behalf,
            responding automatically whenever the other side moves — you won&apos;t need to click
            Accept/Counter yourself while this is on. Every AI-submitted round is clearly labeled.
            If it can&apos;t reach a deal within your range, a Broker steps in to finish it.
          </p>
          <div className="flex gap-2">
            <div>
              <label className="block text-[10px] text-gray-400 mb-0.5">Opening offer</label>
              <input
                name="openingPrice"
                type="number"
                step="0.01"
                min="0"
                defaultValue={defaultPrice}
                required
                className="border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1 text-xs bg-transparent w-28"
              />
            </div>
            <div>
              <label className="block text-[10px] text-gray-400 mb-0.5">
                {partyRole === "retailer" ? "Most you'll pay" : "Least you'll accept"}
              </label>
              <input
                name="walkAwayPrice"
                type="number"
                step="0.01"
                min="0"
                required
                className="border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1 text-xs bg-transparent w-28"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="bg-green-700 text-white rounded-lg px-3 py-1.5 text-xs font-medium"
            >
              Start AI negotiation
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs text-gray-500 dark:text-gray-400"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
