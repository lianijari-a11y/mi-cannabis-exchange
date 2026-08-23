import { allThreadsForBroker, allDealsForBroker } from "@/lib/offers";
import { BrokerDashboardView } from "@/components/broker/broker-dashboard-view";

// Full, real-identity, platform-wide view — the one place in the app where
// both sides of a blind negotiation are ever shown together. See CLAUDE.md
// decisions #2 and #3. Stays a Server Component so the data fetch never
// needs a client round-trip; the actual rendering + search filter live in
// BrokerDashboardView (a client component, since search needs state).
export async function BrokerDashboard({
  setCommissionAction,
  markCommissionPaidAction,
  suggestPriceAction,
}: {
  setCommissionAction: (formData: FormData) => void;
  markCommissionPaidAction: (formData: FormData) => void;
  suggestPriceAction: (formData: FormData) => void;
}) {
  const [threads, deals] = await Promise.all([allThreadsForBroker(), allDealsForBroker()]);
  return (
    <BrokerDashboardView
      threads={threads}
      deals={deals}
      setCommissionAction={setCommissionAction}
      markCommissionPaidAction={markCommissionPaidAction}
      suggestPriceAction={suggestPriceAction}
    />
  );
}
