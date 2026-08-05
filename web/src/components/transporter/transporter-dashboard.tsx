import Link from "next/link";
import { shipmentsForTransporter } from "@/lib/shipments";
import { SHIPMENT_STATUS_LABELS, TERMS_LABELS, type ShipmentStatus, type Terms } from "@/lib/constants";

export async function TransporterDashboard({ transporterId }: { transporterId: string }) {
  const shipments = await shipmentsForTransporter(transporterId);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">My shipments</h1>

      {shipments.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No shipments assigned yet — you'll show up here once a retailer picks you to move a
          deal.
        </p>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        {shipments.map((s) => (
          <Link
            key={s.id}
            href={`/transporter/shipments/${s.id}`}
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 block hover:border-green-600"
          >
            <div className="flex items-start justify-between">
              <h3 className="font-medium text-gray-900 dark:text-gray-100">
                {s.deal.thread.listing.strainName}
              </h3>
              <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">
                {SHIPMENT_STATUS_LABELS[s.status as ShipmentStatus] ?? s.status}
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {s.deal.seller.businessName ?? s.deal.seller.fullName} →{" "}
              {s.deal.retailer.businessName ?? s.deal.retailer.fullName}
            </p>
            <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
              {s.deal.finalQuantity} {s.deal.thread.listing.unit} · ${s.deal.finalPrice}/
              {s.deal.thread.listing.unit} · {TERMS_LABELS[s.deal.finalTerms as Terms] ?? s.deal.finalTerms}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
