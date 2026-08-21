import { SHIPMENT_STATUS_LABELS, type ShipmentStatus } from "@/lib/constants";

// Static Maps API (a plain <img>) rather than the full Maps JavaScript
// API — no client-side script to load, no interactive map needed for a
// single "here's roughly where the load is right now" point. Google Maps
// API keys are designed to be exposed client-side (restricted by HTTP
// referrer in the Google Cloud console, not kept secret the way a normal
// API key is) — this is the expected, documented way to use one in a
// browser, unlike every other credential in this app.
const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

function timeAgo(d: Date | string): string {
  const ms = Date.now() - new Date(d).getTime();
  const mins = Math.round(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  return `${hours} hr ago`;
}

export function ShipmentTimeline({
  status,
  events,
  transporterName,
  driverName,
  driverPhone,
  locationSharingEnabled,
  lastLat,
  lastLng,
  lastLocationAt,
}: {
  status: string;
  events: { id: string; status: string; note: string | null; createdAt: Date | string }[];
  transporterName?: string;
  driverName?: string | null;
  driverPhone?: string | null;
  locationSharingEnabled?: boolean;
  lastLat?: number | null;
  lastLng?: number | null;
  lastLocationAt?: Date | string | null;
}) {
  const hasLivePoint = locationSharingEnabled && lastLat != null && lastLng != null;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {transporterName ? `Shipped via ${transporterName}` : "Shipment"}
        </span>
        <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">
          {SHIPMENT_STATUS_LABELS[status as ShipmentStatus] ?? status}
        </span>
      </div>

      {(driverName || driverPhone) && (
        <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
          Driver: {driverName || "—"}
          {driverPhone ? ` · ${driverPhone}` : ""}
        </p>
      )}

      {hasLivePoint && (
        <div className="mb-2">
          {MAPS_KEY ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`https://maps.googleapis.com/maps/api/staticmap?center=${lastLat},${lastLng}&zoom=11&size=600x240&scale=2&markers=color:green%7C${lastLat},${lastLng}&key=${MAPS_KEY}`}
              alt="Live shipment location"
              className="w-full rounded-lg border border-gray-200 dark:border-gray-800"
            />
          ) : (
            <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/60 rounded-lg px-2.5 py-2">
              Live location: {lastLat?.toFixed(4)}, {lastLng?.toFixed(4)}
            </p>
          )}
          {lastLocationAt && (
            <p className="text-[10px] text-gray-400 mt-0.5">Updated {timeAgo(lastLocationAt)}</p>
          )}
        </div>
      )}

      <ol className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
        {events.map((e) => (
          <li key={e.id}>
            {SHIPMENT_STATUS_LABELS[e.status as ShipmentStatus] ?? e.status}
            {e.note ? ` — "${e.note}"` : ""}
            <span className="text-gray-400 dark:text-gray-500">
              {" "}
              · {new Date(e.createdAt).toLocaleString()}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
