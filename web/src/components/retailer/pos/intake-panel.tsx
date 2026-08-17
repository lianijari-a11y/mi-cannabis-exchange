import { intakeAction } from "@/app/retailer/pos/actions";
import { CATEGORY_LABELS, type Category } from "@/lib/constants";

type Deal = {
  id: string;
  finalQuantity: number;
  finalPrice: number;
  thread: { listing: { strainName: string; category: string; unit: string } };
};

export function IntakePanel({ deals, defaultMarkupPercent }: { deals: Deal[]; defaultMarkupPercent: number | null }) {
  if (deals.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md">
        No delivered deals waiting to be added to inventory. Once a wholesale deal is delivered and
        you accept the product, it shows up here.
      </p>
    );
  }

  return (
    <div className="space-y-3 max-w-2xl">
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Set a markup and, if you know it, the real METRC package tag for this product — without a
        tag, sales against it are still tracked here but won&apos;t be reported to METRC.
      </p>
      {deals.map((deal) => {
        const unitCost = deal.finalPrice / deal.finalQuantity;
        return (
          <form
            key={deal.id}
            action={intakeAction}
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 flex flex-wrap items-end gap-3 text-xs"
          >
            <input type="hidden" name="dealId" value={deal.id} />
            <div className="min-w-[10rem]">
              <p className="font-medium text-gray-900 dark:text-gray-100">{deal.thread.listing.strainName}</p>
              <p className="text-gray-400">
                {CATEGORY_LABELS[deal.thread.listing.category as Category] ?? deal.thread.listing.category} ·{" "}
                {deal.finalQuantity} {deal.thread.listing.unit} @ ${unitCost.toFixed(2)}/{deal.thread.listing.unit}{" "}
                cost
              </p>
            </div>
            <label className="flex flex-col gap-0.5">
              <span className="text-gray-500 dark:text-gray-400">Markup %</span>
              <input
                name="markupPercent"
                type="number"
                min="0"
                step="0.1"
                defaultValue={defaultMarkupPercent ?? 50}
                required
                className="w-20 border border-gray-300 dark:border-gray-700 rounded px-2 py-1 bg-transparent"
              />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-gray-500 dark:text-gray-400">METRC package tag (optional)</span>
              <input
                name="metrcPackageTag"
                placeholder="1A4FF0100000..."
                className="w-40 border border-gray-300 dark:border-gray-700 rounded px-2 py-1 bg-transparent"
              />
            </label>
            {deal.thread.listing.unit === "unit" && (
              <label className="flex flex-col gap-0.5">
                <span className="text-gray-500 dark:text-gray-400">mg THC per unit (optional)</span>
                <input
                  name="thcMgPerUnit"
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="e.g. 10"
                  className="w-24 border border-gray-300 dark:border-gray-700 rounded px-2 py-1 bg-transparent"
                />
              </label>
            )}
            <button type="submit" className="bg-green-700 text-white rounded-lg px-3 py-1.5 font-medium">
              Add to POS
            </button>
          </form>
        );
      })}
    </div>
  );
}
