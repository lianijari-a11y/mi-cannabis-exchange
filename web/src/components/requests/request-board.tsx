import { RespondForm } from "@/components/requests/respond-form";
import { CATEGORY_LABELS, TERMS_LABELS, type Category, type Terms } from "@/lib/constants";

type BoardRequest = {
  id: string;
  productName: string;
  category: string | null;
  quantity: number;
  unit: string;
  targetPrice: number | null;
  termsPreference: string | null;
  note: string | null;
  retailer: { anonHandle: string };
};

export function RequestBoard({
  requests,
  myListings,
  respondAction,
}: {
  requests: BoardRequest[];
  myListings: { id: string; strainName: string }[];
  respondAction: (formData: FormData) => void;
}) {
  if (requests.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">No open buyer requests right now.</p>;
  }

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {requests.map((r) => (
        <div key={r.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-medium text-sm text-gray-900 dark:text-gray-100">{r.productName}</h3>
            <span className="shrink-0 text-[10px] text-gray-400 border border-gray-200 dark:border-gray-700 rounded-full px-2 py-0.5">
              {r.retailer.anonHandle}
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {r.category ? CATEGORY_LABELS[r.category as Category] ?? r.category : "Any category"} ·{" "}
            {r.quantity} {r.unit}
            {r.targetPrice != null ? ` · target $${r.targetPrice}/${r.unit}` : ""}
            {r.termsPreference ? ` · ${TERMS_LABELS[r.termsPreference as Terms] ?? r.termsPreference}` : ""}
          </p>
          {r.note && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{r.note}</p>}
          <RespondForm requestId={r.id} unit={r.unit} myListings={myListings} action={respondAction} />
        </div>
      ))}
    </div>
  );
}
