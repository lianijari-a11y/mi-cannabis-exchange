import { voidSaleAction } from "@/app/retailer/pos/actions";

type Sale = {
  id: string;
  saleNumber: number;
  subtotal: number;
  taxAmount: number;
  total: number;
  tenderType: string;
  orderType: string;
  customerName: string | null;
  status: string;
  metrcStatus: string;
  metrcError: string | null;
  createdAt: Date;
  lineItems: { quantity: number; inventoryLot: { productName: string; unit: string } }[];
};

const METRC_LABEL: Record<string, string> = {
  not_submitted: "Not submitted",
  skipped_no_tag: "No METRC tag on file",
  submitted: "Reported to METRC",
  failed: "METRC submission failed",
};

const ORDER_TYPE_LABELS: Record<string, string> = {
  in_store: "In-store",
  pickup: "Pickup",
  curbside: "Curbside",
};

export function SalesHistoryPanel({ sales }: { sales: Sale[] }) {
  if (sales.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md">No sales yet.</p>;
  }

  return (
    <div className="space-y-2 max-w-2xl">
      {sales.map((sale) => (
        <div
          key={sale.id}
          className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-xs"
        >
          <div className="flex items-center justify-between">
            <p className="font-medium text-gray-900 dark:text-gray-100">
              Sale #{sale.saleNumber}{" "}
              <span className="text-gray-400 font-normal">
                {new Date(sale.createdAt).toLocaleString()} · {sale.tenderType} ·{" "}
                {ORDER_TYPE_LABELS[sale.orderType] ?? sale.orderType}
                {sale.customerName ? ` · ${sale.customerName}` : ""}
              </span>
            </p>
            <div className="flex items-center gap-2">
              <span className="text-gray-900 dark:text-gray-100 font-medium">${sale.total.toFixed(2)}</span>
              {sale.status === "completed" ? (
                <form action={voidSaleAction}>
                  <input type="hidden" name="saleId" value={sale.id} />
                  <button type="submit" className="text-red-500 underline">
                    Void
                  </button>
                </form>
              ) : (
                <span className="text-red-500">voided</span>
              )}
            </div>
          </div>
          <p className="text-gray-400 mt-1">
            {sale.lineItems.map((li) => `${li.inventoryLot.productName} ×${li.quantity}`).join(", ")}
          </p>
          <p
            className={`mt-1 ${
              sale.metrcStatus === "submitted"
                ? "text-green-700 dark:text-green-400"
                : sale.metrcStatus === "failed"
                ? "text-red-500"
                : "text-gray-400"
            }`}
            title={sale.metrcError ?? undefined}
          >
            {METRC_LABEL[sale.metrcStatus] ?? sale.metrcStatus}
          </p>
        </div>
      ))}
    </div>
  );
}
