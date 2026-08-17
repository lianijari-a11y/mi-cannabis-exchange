import { notFound } from "next/navigation";
import Link from "next/link";
import { orderStatus } from "@/lib/storefront";

const STATUS_LABELS: Record<string, string> = {
  placed: "Order placed — we'll have it ready soon",
  ready: "Ready for pickup",
  picked_up: "Picked up",
  canceled: "Canceled",
};

const money = (n: number) => `$${n.toFixed(2)}`;

// Public, no auth — looked up by the order's own id, same trust level as
// e.g. an email receipt link. See CLAUDE.md §25.
export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ slug: string; orderId: string }>;
}) {
  const { slug, orderId } = await params;
  const order = await orderStatus(orderId);
  if (!order) notFound();

  const total = order.lineItems.reduce((sum, li) => sum + li.lineTotal, 0);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logos/xcelerate-icon.png" alt="Xcelerate POS" className="w-9 h-9 rounded-lg object-cover" />
          <span className="font-semibold text-lg text-gray-900 dark:text-gray-100">
            {order.retailer.businessName ?? "Dispensary"}
          </span>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 space-y-4">
          <div>
            <p className="text-xs text-gray-400 dark:text-gray-500">Thanks, {order.customerName}</p>
            <h1 className="text-base font-semibold text-green-700 dark:text-green-400 mt-1">
              {STATUS_LABELS[order.status] ?? order.status}
            </h1>
            {order.requestedPickupNote && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Note: {order.requestedPickupNote}
              </p>
            )}
          </div>

          <div className="text-xs space-y-1 border-t border-gray-200 dark:border-gray-800 pt-3">
            {order.lineItems.map((li, i) => (
              <div key={i} className="flex justify-between text-gray-700 dark:text-gray-300">
                <span>
                  {li.inventoryLot.productName} × {li.quantity} {li.inventoryLot.unit}
                </span>
                <span>{money(li.lineTotal)}</span>
              </div>
            ))}
          </div>

          <div className="flex justify-between text-sm font-semibold text-gray-900 dark:text-gray-100 border-t border-gray-200 dark:border-gray-800 pt-3">
            <span>Total (pay at pickup)</span>
            <span>{money(total)}</span>
          </div>
        </div>

        <p className="mt-4 text-xs text-gray-400 dark:text-gray-500 text-center">
          <Link href={`/order/${slug}`} className="text-green-700 dark:text-green-400">
            Back to menu
          </Link>
        </p>
      </div>
    </div>
  );
}
