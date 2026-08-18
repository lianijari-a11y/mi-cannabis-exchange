import Link from "next/link";
import { updateMarkupAction, voidLotAction } from "@/app/retailer/pos/actions";
import { BarcodeLabel } from "./barcode-label";
import { LOW_STOCK_THRESHOLD } from "@/lib/constants";

// Below this share of original stock, nudge the retailer to go reorder from
// the Cannabliz wholesale feed — see CLAUDE.md §28. Deliberately just a
// link into the existing Retailer browse/search flow, not a new reorder
// mechanism: /retailer already supports ?q= (lib/retailer search).

type Lot = {
  id: string;
  sku: string;
  productName: string;
  unit: string;
  quantityRemaining: number;
  quantityReceived: number;
  unitCost: number;
  markupPercent: number;
  retailPricePerUnit: number;
  status: string;
  metrcPackageTag: string | null;
  thcPercent: number | null;
  thcMgPerUnit: number | null;
};

export function InventoryPanel({ lots }: { lots: Lot[] }) {
  if (lots.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md">
        No POS inventory yet — add a delivered deal from the Intake tab first.
      </p>
    );
  }

  return (
    <div className="space-y-3 max-w-3xl">
      {lots.map((lot) => {
        const lowStock = lot.status === "active" && lot.quantityRemaining / lot.quantityReceived <= LOW_STOCK_THRESHOLD;
        return (
        <div
          key={lot.id}
          className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 flex flex-wrap items-center gap-4 text-xs"
        >
          <BarcodeLabel value={lot.sku} />
          <div className="min-w-[9rem]">
            <p className="font-medium text-gray-900 dark:text-gray-100">{lot.productName}</p>
            <p className="text-gray-400">
              {lot.quantityRemaining} / {lot.quantityReceived} {lot.unit} left ·{" "}
              <span
                className={
                  lot.status === "active"
                    ? "text-green-700 dark:text-green-400"
                    : lot.status === "depleted"
                    ? "text-gray-400"
                    : "text-red-500"
                }
              >
                {lot.status}
              </span>
            </p>
            {lowStock && (
              <p className="text-amber-600 dark:text-amber-400">
                Running low —{" "}
                <Link href={`/retailer?q=${encodeURIComponent(lot.productName)}`} className="underline">
                  shop Cannabliz for more
                </Link>
              </p>
            )}
            {!lot.metrcPackageTag && (
              <p className="text-amber-600 dark:text-amber-400">No METRC tag — sales won&apos;t be reported</p>
            )}
            {(lot.thcPercent != null || lot.thcMgPerUnit != null) && (
              <p className="text-gray-400">
                {lot.thcMgPerUnit != null ? `${lot.thcMgPerUnit}mg THC/unit` : `${lot.thcPercent}% THC`}
              </p>
            )}
          </div>
          <p className="text-gray-500 dark:text-gray-400">
            Cost ${lot.unitCost.toFixed(2)} → sells ${lot.retailPricePerUnit.toFixed(2)}
          </p>
          {lot.status !== "voided" && (
            <form action={updateMarkupAction} className="flex items-center gap-1">
              <input type="hidden" name="lotId" value={lot.id} />
              <input
                name="markupPercent"
                type="number"
                min="0"
                step="0.1"
                defaultValue={lot.markupPercent}
                className="w-16 border border-gray-300 dark:border-gray-700 rounded px-1 py-1 bg-transparent"
              />
              <span className="text-gray-400">%</span>
              <button type="submit" className="text-green-700 dark:text-green-400 underline">
                Update
              </button>
            </form>
          )}
          {lot.status !== "voided" && (
            <form action={voidLotAction}>
              <input type="hidden" name="lotId" value={lot.id} />
              <button type="submit" className="text-red-500 underline">
                Void
              </button>
            </form>
          )}
        </div>
        );
      })}
    </div>
  );
}
