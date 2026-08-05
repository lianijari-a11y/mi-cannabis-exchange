import { SHIPMENT_STATUS_LABELS, type ShipmentStatus } from "@/lib/constants";

export function ShipmentTimeline({
  status,
  events,
  transporterName,
}: {
  status: string;
  events: { id: string; status: string; note: string | null; createdAt: Date | string }[];
  transporterName?: string;
}) {
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
