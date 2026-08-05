import { ShipmentTimeline } from "@/components/deal/shipment-timeline";

type DealShipment = {
  status: string;
  transporter: { businessName: string | null; fullName: string };
  events: { id: string; status: string; note: string | null; createdAt: Date }[];
};

type Deal = {
  id: string;
  invoiceUrl: string | null;
  invoiceAcceptedAt: Date | null;
  shipment: DealShipment | null;
};

export function DealPanelSeller({
  deal,
  listingId,
  invoiceAction,
}: {
  deal: Deal;
  listingId: string;
  invoiceAction: (formData: FormData) => void;
}) {
  return (
    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
      <h3 className="text-xs font-semibold text-gray-900 dark:text-gray-100 mb-2">Fulfillment</h3>

      {!deal.invoiceUrl && (
        <form action={invoiceAction} className="space-y-2">
          <input type="hidden" name="dealId" value={deal.id} />
          <input type="hidden" name="listingId" value={listingId} />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Upload your invoice for this deal — the retailer reviews it and picks a transporter
            once they accept.
          </p>
          <input
            type="file"
            name="invoice"
            accept="image/*,application/pdf"
            required
            className="text-xs file:mr-3 file:rounded-md file:border-0 file:bg-green-700 file:text-white file:px-3 file:py-1.5 file:text-xs"
          />
          <div>
            <button
              type="submit"
              className="bg-green-700 text-white rounded-lg px-3 py-1.5 text-xs font-medium"
            >
              Upload invoice
            </button>
          </div>
        </form>
      )}

      {deal.invoiceUrl && !deal.shipment && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Invoice sent —{" "}
          <a href={deal.invoiceUrl} target="_blank" className="text-green-700 underline">
            view it
          </a>
          . Waiting on the retailer to accept and pick a transporter.
        </p>
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
