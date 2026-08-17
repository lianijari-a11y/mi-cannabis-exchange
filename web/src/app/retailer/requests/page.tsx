import { requireRole } from "@/lib/dal";
import { PortalShell } from "@/components/portal-shell";
import { productRequestsForRetailer } from "@/lib/product-requests";
import { RequestForm } from "@/components/requests/request-form";
import { CATEGORY_LABELS, TERMS_LABELS, type Category, type Terms } from "@/lib/constants";
import { createRequest, closeRequest } from "./actions";

const NAV = [
  { href: "/retailer", label: "Browse inventory" },
  { href: "/retailer/negotiations", label: "My negotiations" },
  { href: "/retailer/watchlist", label: "Watchlist" },
  { href: "/retailer/requests", label: "Wanted board" },
  { href: "/retailer/pos", label: "Point of sale" },
  { href: "/retailer/settings", label: "Settings" },
];

export default async function RetailerRequestsPage() {
  const session = await requireRole("retailer");
  const requests = await productRequestsForRetailer(session.user.id);

  return (
    <PortalShell roleLabel="Retailer" navItems={NAV}>
      <div className="flex items-start justify-between flex-wrap gap-3 mb-1">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Wanted board</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Post something you need that isn&apos;t currently listed — every Grower, Processor,
            and Broker can see it (as your anonymous handle) and respond.
          </p>
        </div>
      </div>

      <div className="mt-4 mb-6">
        <RequestForm action={createRequest} />
      </div>

      {requests.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">No requests posted yet.</p>
      ) : (
        <div className="space-y-4">
          {requests.map((r) => (
            <div key={r.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <h3 className="font-medium text-sm text-gray-900 dark:text-gray-100">{r.productName}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {r.category ? CATEGORY_LABELS[r.category as Category] ?? r.category : "Any category"} ·{" "}
                    {r.quantity} {r.unit}
                    {r.targetPrice != null ? ` · target $${r.targetPrice}/${r.unit}` : ""}
                    {r.termsPreference ? ` · ${TERMS_LABELS[r.termsPreference as Terms] ?? r.termsPreference}` : ""}
                  </p>
                  {r.note && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{r.note}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] rounded-full px-2 py-0.5 border ${
                      r.status === "open"
                        ? "text-green-700 border-green-300 dark:border-green-800"
                        : "text-gray-400 border-gray-200 dark:border-gray-700"
                    }`}
                  >
                    {r.status === "open" ? "Open" : "Closed"}
                  </span>
                  {r.status === "open" && (
                    <form action={closeRequest}>
                      <input type="hidden" name="requestId" value={r.id} />
                      <button type="submit" className="text-[10px] text-gray-400 underline">
                        Close
                      </button>
                    </form>
                  )}
                </div>
              </div>

              {r.responses.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 space-y-2">
                  <p className="text-[10px] uppercase tracking-wide text-gray-400">
                    {r.responses.length} response{r.responses.length === 1 ? "" : "s"}
                  </p>
                  {r.responses.map((resp) => (
                    <div key={resp.id} className="text-xs text-gray-600 dark:text-gray-300 flex flex-wrap items-center gap-2">
                      <span className="text-[10px] text-gray-400 border border-gray-200 dark:border-gray-700 rounded-full px-2 py-0.5">
                        {resp.supplier.anonHandle}
                      </span>
                      <span>
                        {resp.price != null ? `$${resp.price}` : ""}
                        {resp.quantity != null ? ` · ${resp.quantity} ${r.unit}` : ""}
                        {resp.message ? ` — ${resp.message}` : ""}
                      </span>
                      {resp.listing && (
                        <a
                          href={`/retailer/listings/${resp.listing.id}`}
                          className="text-green-700 underline"
                        >
                          View linked listing
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </PortalShell>
  );
}
