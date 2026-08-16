// Shown to the grower or retailer once a transporter has proposed a
// pickup/delivery window (Shipment.scheduledPickupAt) — each side accepts
// separately; both have to accept before the transporter can mark it picked
// up. See lib/shipments.ts's acceptShipmentSchedule and CLAUDE.md §13.
export function ScheduleAcceptPanel({
  scheduledPickupAt,
  scheduledDeliveryAt,
  ownAccepted,
  otherAccepted,
  otherLabel,
  shipmentId,
  listingId,
  acceptAction,
}: {
  scheduledPickupAt: Date | string | null;
  scheduledDeliveryAt: Date | string | null;
  ownAccepted: boolean;
  otherAccepted: boolean;
  otherLabel: string;
  shipmentId: string;
  listingId: string;
  acceptAction: (formData: FormData) => void;
}) {
  if (!scheduledPickupAt) return null;

  return (
    <div className="mt-2 border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
      <p className="text-xs font-medium text-gray-900 dark:text-gray-100 mb-1">
        Proposed pickup: {new Date(scheduledPickupAt).toLocaleString()}
      </p>
      {scheduledDeliveryAt && (
        <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
          Proposed delivery: {new Date(scheduledDeliveryAt).toLocaleString()}
        </p>
      )}
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
        {otherLabel} has {otherAccepted ? "accepted" : "not accepted yet"}.
      </p>
      {ownAccepted ? (
        <p className="text-xs text-green-700 dark:text-green-400 font-medium">
          You've accepted this schedule.
        </p>
      ) : (
        <form action={acceptAction}>
          <input type="hidden" name="shipmentId" value={shipmentId} />
          <input type="hidden" name="listingId" value={listingId} />
          <button
            type="submit"
            className="bg-blue-700 text-white rounded-lg px-3 py-1.5 text-xs font-medium"
          >
            Accept this schedule
          </button>
        </form>
      )}
    </div>
  );
}
