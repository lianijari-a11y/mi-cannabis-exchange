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

// datetime-local inputs need "YYYY-MM-DDTHH:mm", not a full ISO string.
function toLocalInputValue(d: Date | string | null): string {
  if (!d) return "";
  const date = new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

export async function TransporterShipmentDetail({
  shipmentId,
  transporterId,
  advanceAction,
  proposeScheduleAction,
  transportFeeAction,
  transportInvoiceAction,
  confirmTransportFeePaidAction,
  error,
}: {
  shipmentId: string;
  transporterId: string;
  advanceAction: (formData: FormData) => void;
  proposeScheduleAction: (formData: FormData) => void;
  transportFeeAction: (formData: FormData) => void;
  transportInvoiceAction: (formData: FormData) => void;
  confirmTransportFeePaidAction: (formData: FormData) => void;
  error?: string;
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

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Pickup / delivery schedule
        </h2>
        {shipment.scheduledPickupAt ? (
          <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
            <p>Pickup: {new Date(shipment.scheduledPickupAt).toLocaleString()}</p>
            {shipment.scheduledDeliveryAt && (
              <p>Delivery: {new Date(shipment.scheduledDeliveryAt).toLocaleString()}</p>
            )}
            <p className="flex gap-3 mt-1">
              <span className={shipment.growerAcceptedSchedule ? "text-green-700 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}>
                Grower {shipment.growerAcceptedSchedule ? "accepted" : "hasn't accepted yet"}
              </span>
              <span className={shipment.retailerAcceptedSchedule ? "text-green-700 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}>
                Retailer {shipment.retailerAcceptedSchedule ? "accepted" : "hasn't accepted yet"}
              </span>
            </p>
          </div>
        ) : (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            No schedule proposed yet — optional, but the grower/retailer both have to accept one
            before you can mark this picked up.
          </p>
        )}
        <form action={proposeScheduleAction} className="grid sm:grid-cols-2 gap-2">
          <input type="hidden" name="shipmentId" value={shipment.id} />
          <div>
            <label className="text-[10px] text-gray-400 block">Pickup date/time</label>
            <input
              type="datetime-local"
              name="scheduledPickupAt"
              defaultValue={toLocalInputValue(shipment.scheduledPickupAt)}
              className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1.5 text-xs bg-transparent"
            />
          </div>
          <div>
            <label className="text-[10px] text-gray-400 block">Delivery date/time</label>
            <input
              type="datetime-local"
              name="scheduledDeliveryAt"
              defaultValue={toLocalInputValue(shipment.scheduledDeliveryAt)}
              className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1.5 text-xs bg-transparent"
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg px-3 py-1.5 text-xs font-medium"
            >
              {shipment.scheduledPickupAt ? "Update schedule" : "Propose schedule"}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Your transport fee</h2>
        {shipment.transportFeeAmount != null && (
          <p className="text-xs text-gray-600 dark:text-gray-400">
            ${shipment.transportFeeAmount} —{" "}
            {shipment.transportFeePayer === "split"
              ? `split ${shipment.transportFeeSplitGrowerPct}/${100 - (shipment.transportFeeSplitGrowerPct ?? 50)} grower/retailer`
              : `${shipment.transportFeePayer} pays`}{" "}
            ·{" "}
            <span className={shipment.transportFeeStatus === "paid" ? "text-green-700 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}>
              {shipment.transportFeeStatus === "paid" ? "paid" : "pending"}
            </span>
          </p>
        )}
        <form action={transportFeeAction} className="flex flex-wrap gap-2 items-end">
          <input type="hidden" name="shipmentId" value={shipment.id} />
          <div>
            <label className="text-[10px] text-gray-400 block">Fee ($)</label>
            <input
              name="transportFeeAmount"
              type="number"
              step="0.01"
              min="0"
              defaultValue={shipment.transportFeeAmount ?? ""}
              className="border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1.5 text-xs bg-transparent w-24"
            />
          </div>
          <div>
            <label className="text-[10px] text-gray-400 block">Who pays</label>
            <select
              name="transportFeePayer"
              defaultValue={shipment.transportFeePayer ?? "split"}
              className="border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1.5 text-xs bg-transparent"
            >
              <option value="split">Split 50/50</option>
              <option value="grower">Grower pays</option>
              <option value="retailer">Retailer pays</option>
            </select>
          </div>
          <button
            type="submit"
            className="border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg px-3 py-1.5 text-xs font-medium"
          >
            {shipment.transportFeeAmount != null ? "Update fee" : "Set fee"}
          </button>
        </form>

        {shipment.transportFeeAmount != null && (
          <>
            <form action={transportInvoiceAction} className="flex items-center gap-2">
              <input type="hidden" name="shipmentId" value={shipment.id} />
              {shipment.transportInvoiceUrl ? (
                <a href={shipment.transportInvoiceUrl} target="_blank" className="text-xs text-green-700 underline">
                  View invoice
                </a>
              ) : (
                <span className="text-xs text-gray-400">No invoice uploaded yet</span>
              )}
              <input
                type="file"
                name="invoice"
                accept="image/*,application/pdf"
                className="text-xs file:mr-2 file:rounded-md file:border-0 file:bg-gray-700 file:text-white file:px-2 file:py-1 file:text-xs"
              />
              <button type="submit" className="text-xs border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1">
                Upload
              </button>
            </form>
            {shipment.transportFeeStatus !== "paid" && (
              <form action={confirmTransportFeePaidAction}>
                <input type="hidden" name="shipmentId" value={shipment.id} />
                <button type="submit" className="text-xs bg-green-700 text-white rounded-lg px-3 py-1.5 font-medium">
                  Mark fee as paid
                </button>
              </form>
            )}
          </>
        )}
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
