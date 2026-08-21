"use client";

import { useEffect, useRef, useState } from "react";

// Opt-in live location while a shipment is genuinely in transit — the
// driver's own phone (already logged into this PWA to run the rest of
// the shipment flow) reports its position via the browser's own
// Geolocation API. Nothing third-party, no separate app. Off by default;
// this component only renders the toggle for statuses where "in transit"
// actually applies (picked_up/in_transit) — a shipment that's still
// "assigned" or already "delivered" has nothing to track.
export function LocationSharingToggle({
  shipmentId,
  enabled,
  toggleAction,
  reportLocationAction,
}: {
  shipmentId: string;
  enabled: boolean;
  toggleAction: (formData: FormData) => void;
  reportLocationAction: (shipmentId: string, lat: number, lng: number) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [error, setError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (!("geolocation" in navigator)) {
      setError("This device/browser doesn't support location sharing.");
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        reportLocationAction(shipmentId, position.coords.latitude, position.coords.longitude).then((result) => {
          if (!result.ok) setError(result.error ?? "Couldn't report location.");
          else setError(null);
        });
      },
      (err) => setError(err.message || "Location access denied."),
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 20_000 }
    );

    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, shipmentId]);

  return (
    <div className="space-y-1.5">
      <form action={toggleAction}>
        <input type="hidden" name="shipmentId" value={shipmentId} />
        <input type="hidden" name="enabled" value={(!enabled).toString()} />
        <button
          type="submit"
          className={`text-xs rounded-lg px-3 py-1.5 font-medium ${
            enabled
              ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900"
              : "bg-green-700 text-white"
          }`}
        >
          {enabled ? "Stop sharing my location" : "Share my live location"}
        </button>
      </form>
      {enabled && (
        <p className="text-[11px] text-gray-500 dark:text-gray-400">
          Your position updates automatically while this page is open. Turns off (and clears)
          automatically once this shipment is marked delivered.
        </p>
      )}
      {error && <p className="text-[11px] text-red-600">{error}</p>}
    </div>
  );
}
