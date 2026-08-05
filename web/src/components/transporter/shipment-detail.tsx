import { notFound } from "next/navigation";
import { shipmentForTransporter } from "@/lib/shipments";
import {
  NEXT_SHIPMENT_STATUS,
  SHIPMENT_STATUS_LABELS,
  TERMS_LABELS,
  type ShipmentStatus,
  type Terms,
} from "@/lib/constants";

function AddressBlock({
  label,
  party,
}: {
  label: string;
  party: {
    businessName: string | null;
    fullName: string;
    address: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
  };
}) {
  return (
    <div>
      <p className="text-xs text-gray-400 dark:text-gray-500">{label}</p>
      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
        {party.businessName ?? party.fullName}
      </p>
      {party.address && (
        <p className="text-xs text-gray-600 dark:text-gray-400">
          {party.address}, {party.city}, {party.state} {party.zip}
        </p>
      )}
    </div>
  );
}

export async function TransporterShipmentDetail({
  shipmentId,
  transporterId,
  advanceAction,
}: {
  shipmentId: string;
  transporterId: string;
  advanceAction: (formData: FormData) => void;
}) {
  const shipment = await shipmentForTransporter(shipmentId, transporterId);
  if (!shipment) notFound();

  const next = NEXT_SHIPMENT_STATUS[shipment.status as ShipmentStatus];

  return (
    <div className="space-y-6 max-w-lg">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 space-y-4">
        <div className="flex items-start justify-between">
          <h1 className="font-semibold text-gray-900 dark:text-gray-100">
            {shipment.deal.thread.listing.strainName}
          </h1>
          <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">
            {SHIPMENT_STATUS_LABELS[shipment.status as ShipmentStatus] ?? shipment.status}
          </span>
        </div>
        <p className="text-sm text-gray-700 dark:text-gray-300">
          {shipment.deal.finalQuantity} {shipment.deal.thread.listing.unit} · $
          {shipment.deal.finalPrice}/{shipment.deal.thread.listing.unit} ·{" "}
          {TERMS_LABELS[shipment.deal.finalTerms as Terms] ?? shipment.deal.finalTerms}
        </p>

        <div className="grid sm:grid-cols-2 gap-4">
          <AddressBlock label="Pickup" party={shipment.deal.seller} />
          <AddressBlock label="Delivery" party={shipment.deal.retailer} />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Timeline</h2>
        <ol className="space-y-1 text-xs text-gray-600 dark:text-gray-400 mb-4">
          {shipment.events.map((e) => (
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

        {shipment.podUrl && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            Proof of delivery:{" "}
            <a href={shipment.podUrl} target="_blank" className="text-green-700 underline">
              view
            </a>
          </p>
        )}

        {next && (
          <form action={advanceAction} className="space-y-2">
            <input type="hidden" name="shipmentId" value={shipment.id} />
            <input
              name="note"
              placeholder="Note (optional)"
              className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1.5 text-xs bg-transparent"
            />
            {next === "delivered" && (
              <input
                type="file"
                name="pod"
                accept="image/*,application/pdf"
                className="text-xs file:mr-3 file:rounded-md file:border-0 file:bg-green-700 file:text-white file:px-3 file:py-1.5 file:text-xs"
              />
            )}
            <button
              type="submit"
              className="bg-green-700 text-white rounded-lg px-3 py-1.5 text-xs font-medium"
            >
              Mark as {SHIPMENT_STATUS_LABELS[next]}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
