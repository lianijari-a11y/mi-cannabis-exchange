import { ShipmentTimeline } from "@/components/deal/shipment-timeline";

type DealShipment = {
  status: string;
  transporter: { businessName: string | null; fullName: string };
  events: { id: string; status: string; note: string | null; createdAt: Date }[];
};

type Deal = {
  id: string;
  invoiceUrl: string | null;
  shipment: DealShipment | null;
};

type Transporter = { id: string; businessName: string | null; fullName: string; preferredTransporter: boolean };

export function DealPanelRetailer({
  deal,
  listingId,
  transporters,
  acceptInvoiceAction,
}: {
  deal: Deal;
  listingId: string;
  transporters: Transporter[];
  acceptInvoiceAction: (formData: FormData) => void;
}) {
  const preferred = transporters.find((t) => t.preferredTransporter);

  return (
    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
      <h3 className="text-xs font-semibold text-gray-900 dark:text-gray-100 mb-2">Fulfillment</h3>

      {!deal.invoiceUrl && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Waiting on the seller to upload an invoice.
        </p>
      )}

      {deal.invoiceUrl && !deal.shipment && (
        <form action={acceptInvoiceAction} className="space-y-2">
          <input type="hidden" name="dealId" value={deal.id} />
          <input type="hidden" name="listingId" value={listingId} />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            <a href={deal.invoiceUrl} target="_blank" className="text-green-700 underline">
              View invoice
            </a>{" "}
            — accept it and pick a transporter to move the order.
          </p>
          {transporters.length === 0 ? (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              No approved transporters yet — check back once one is on the platform.
            </p>
          ) : (
            <>
              <select
                name="transporterId"
                defaultValue={preferred?.id ?? transporters[0]?.id}
                className="border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1.5 text-xs bg-transparent"
              >
                {transporters.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.businessName ?? t.fullName}
                    {t.preferredTransporter ? " (preferred)" : ""}
                  </option>
                ))}
              </select>
              <div>
                <button
                  type="submit"
                  className="bg-green-700 text-white rounded-lg px-3 py-1.5 text-xs font-medium"
                >
                  Accept invoice & set up transport
                </button>
              </div>
            </>
          )}
        </form>
      )}

      {deal.shipment && (
        <ShipmentTimeline
          status={deal.shipment.status}
          events={deal.shipment.events}
          transporterName={deal.shipment.transporter.businessName ?? deal.shipment.transporter.fullName}
        />
      )}
    </div>
  );
}
