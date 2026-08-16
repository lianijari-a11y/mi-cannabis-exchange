import { soldComps } from "@/lib/market";
import { TERMS_LABELS, type Terms } from "@/lib/constants";

export async function SoldComps({
  category,
  excludeListingId,
}: {
  category: string;
  excludeListingId: string;
}) {
  const comps = await soldComps(category, excludeListingId);
  if (comps.length === 0) return null;

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
        Recent sold comps — same category
      </h2>
      <ul className="space-y-1.5 text-xs text-gray-600 dark:text-gray-400">
        {comps.map((c) => (
          <li key={c.id} className="flex items-center justify-between">
            <span>
              {c.thread.listing.strainName} — {c.finalQuantity} {c.thread.listing.unit}
            </span>
            <span className="font-medium text-gray-800 dark:text-gray-200">
              ${c.finalPrice}/{c.thread.listing.unit} ·{" "}
              {TERMS_LABELS[c.finalTerms as Terms] ?? c.finalTerms}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
