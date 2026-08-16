import { requireRole } from "@/lib/dal";
import { PortalShell } from "@/components/portal-shell";
import { allProductRequestsForBroker } from "@/lib/product-requests";
import { CATEGORY_LABELS, TERMS_LABELS, type Category, type Terms } from "@/lib/constants";

const NAV = [
  { href: "/broker", label: "All negotiations" },
  { href: "/broker/listings/new", label: "Post inventory" },
  { href: "/broker/requests", label: "Buyer requests" },
  { href: "/broker/settings", label: "Settings" },
];

export default async function BrokerRequestsPage() {
  await requireRole("broker");
  const requests = await allProductRequestsForBroker();

  return (
    <PortalShell roleLabel="Broker" navItems={NAV}>
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
        Buyer requests — platform-wide
      </h1>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
        Real identities on both sides, same visibility as every negotiation you see elsewhere.
      </p>

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
                    Requested by {r.retailer.businessName ?? r.retailer.fullName} ·{" "}
                    {r.category ? CATEGORY_LABELS[r.category as Category] ?? r.category : "Any category"} ·{" "}
                    {r.quantity} {r.unit}
                    {r.targetPrice != null ? ` · target $${r.targetPrice}/${r.unit}` : ""}
                    {r.termsPreference ? ` · ${TERMS_LABELS[r.termsPreference as Terms] ?? r.termsPreference}` : ""}
                  </p>
                </div>
                <span
                  className={`text-[10px] rounded-full px-2 py-0.5 border ${
                    r.status === "open"
                      ? "text-green-700 border-green-300 dark:border-green-800"
                      : "text-gray-400 border-gray-200 dark:border-gray-700"
                  }`}
                >
                  {r.status === "open" ? "Open" : "Closed"}
                </span>
              </div>

              {r.responses.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 space-y-1">
                  {r.responses.map((resp) => (
                    <p key={resp.id} className="text-xs text-gray-600 dark:text-gray-300">
                      {resp.supplier.businessName ?? resp.supplier.fullName}:{" "}
                      {resp.price != null ? `$${resp.price} ` : ""}
                      {resp.quantity != null ? `· ${resp.quantity} ${r.unit} ` : ""}
                      {resp.message}
                      {resp.listing && ` (linked: ${resp.listing.strainName})`}
                    </p>
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
