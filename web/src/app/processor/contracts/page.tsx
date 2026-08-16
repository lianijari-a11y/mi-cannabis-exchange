import { requireRole } from "@/lib/dal";
import { PortalShell } from "@/components/portal-shell";
import { splitContractsForProcessor } from "@/lib/split-contracts";
import { startProcessingAction, logYieldAction, settleContractAction } from "./actions";

const NAV = [
  { href: "/processor", label: "My listings" },
  { href: "/processor/sourcing", label: "Sourcing" },
  { href: "/processor/contracts", label: "My contracts" },
  { href: "/processor/listings/new", label: "Post inventory" },
  { href: "/processor/requests", label: "Buyer requests" },
  { href: "/processor/settings", label: "Settings" },
];

const STATUS_STYLE: Record<string, string> = {
  proposed: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
  accepted: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  processing: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-400",
  finished: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  settled: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
};

export default async function ProcessorContractsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireRole("processor");
  const { error } = await searchParams;
  const contracts = await splitContractsForProcessor(session.user.id);

  return (
    <PortalShell roleLabel="Processor" navItems={NAV}>
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
        My toll-processing contracts
      </h1>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
        Proposals you've sent, and the ones the grower accepted, through settlement.
      </p>

      {error && <p className="text-xs text-red-600 mb-4">{error}</p>}

      {contracts.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No contracts yet — propose one from{" "}
          <a href="/processor/sourcing" className="text-teal-700 dark:text-teal-400 underline">
            Sourcing
          </a>
          .
        </p>
      ) : (
        <div className="space-y-3">
          {contracts.map((contract) => (
            <div
              key={contract.id}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {contract.listing.strainName} — {contract.outputProduct}
                </span>
                <span
                  className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full ${
                    STATUS_STYLE[contract.status] ?? ""
                  }`}
                >
                  {contract.status}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                {contract.grower.anonHandle} · {contract.splitGrowerPct}/
                {100 - contract.splitGrowerPct} split
              </p>

              {contract.status === "accepted" && (
                <form action={startProcessingAction}>
                  <input type="hidden" name="contractId" value={contract.id} />
                  <button
                    type="submit"
                    className="bg-teal-700 text-white rounded-lg px-3 py-1.5 text-xs font-medium"
                  >
                    Start processing
                  </button>
                </form>
              )}

              {contract.status === "processing" && (
                <form action={logYieldAction} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="contractId" value={contract.id} />
                  <div>
                    <label className="text-[10px] text-gray-500 dark:text-gray-400 block mb-1">
                      Yield qty
                    </label>
                    <input
                      name="yieldQty"
                      type="number"
                      step="0.01"
                      required
                      className="border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1.5 text-xs bg-transparent w-24"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 dark:text-gray-400 block mb-1">
                      Unit
                    </label>
                    <input
                      name="yieldUnit"
                      placeholder={`lb ${contract.outputProduct}`}
                      required
                      className="border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1.5 text-xs bg-transparent w-32"
                    />
                  </div>
                  <button
                    type="submit"
                    className="bg-teal-700 text-white rounded-lg px-3 py-1.5 text-xs font-medium"
                  >
                    Log yield &amp; finish
                  </button>
                </form>
              )}

              {contract.status === "finished" && (
                <>
                  {contract.yieldQty != null && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                      Yield: {contract.yieldQty} {contract.yieldUnit}
                    </p>
                  )}
                  <form action={settleContractAction} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="contractId" value={contract.id} />
                    <div>
                      <label className="text-[10px] text-gray-500 dark:text-gray-400 block mb-1">
                        Settlement value ($)
                      </label>
                      <input
                        name="settlementValue"
                        type="number"
                        step="0.01"
                        required
                        className="border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1.5 text-xs bg-transparent w-32"
                      />
                    </div>
                    <button
                      type="submit"
                      className="bg-teal-700 text-white rounded-lg px-3 py-1.5 text-xs font-medium"
                    >
                      Settle contract
                    </button>
                  </form>
                </>
              )}

              {contract.status === "settled" && (
                <p className="text-xs text-green-700 dark:text-green-400 font-medium">
                  Settled at ${contract.settlementValue} — you keep $
                  {contract.settlementProcessorAmount}, grower gets $
                  {contract.settlementGrowerAmount}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </PortalShell>
  );
}
