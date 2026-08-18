import { EyeOff, Handshake, ShieldCheck, ScrollText, Lock, Wallet } from "lucide-react";

const PILLARS = [
  {
    icon: EyeOff,
    title: "Blind by design",
    body: "Grower/Processor and Retailer never see each other's identity — not before a deal, not after. It's enforced where it counts: the API never returns the counterparty's real business record to the other side, not just hidden in the UI.",
  },
  {
    icon: Handshake,
    title: "Broker oversight, platform-wide",
    body: "Every negotiation and every closed deal is visible to the broker in real identity on both sides — the broker is the marketplace operator's own intermediary, not an outside agent competing for deals.",
  },
  {
    icon: ShieldCheck,
    title: "Michigan-licensed roles only",
    body: "Grower, Processor, Retailer, and Secure Transporter accounts go through license verification before they're trusted with the roles the state's licensing structure implies.",
  },
  {
    icon: ScrollText,
    title: "Negotiation tooling, not a manifest",
    body: "A Deal here is a negotiated agreement and a Shipment is operational tracking — the actual license-to-license transfer and your METRC manifest still happen the way they always have, outside this app.",
  },
  {
    icon: Lock,
    title: "Credentials encrypted at rest",
    body: "METRC and payment-connection API keys are encrypted, not stored in plain text — settings forms show a masked reference, never the live value, and a blank field always means \"keep what's on file.\"",
  },
  {
    icon: Wallet,
    title: "Every dollar tracked, none of it moved",
    body: "Commission, rejection fees, transport fees, and POS sales are all recorded here — this app has never processed a card, an ACH transfer, or cash. Money changes hands the way it always has, off-platform.",
  },
];

export function Compliance() {
  return (
    <section
      id="compliance"
      className="max-w-6xl mx-auto px-4 py-20 scroll-mt-16 border-t border-gray-200 dark:border-gray-800"
    >
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-green-700 dark:text-green-400">
          Trust & compliance
        </p>
        <h2 className="mt-2 text-3xl font-semibold text-gray-900 dark:text-gray-100">
          Built around Michigan's rules, not around ours
        </h2>
        <p className="mt-3 text-gray-600 dark:text-gray-400">
          The exchange is negotiation and logistics tooling for licensed operators — it stays out
          of the way of the actual regulated transfer.
        </p>
      </div>

      <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {PILLARS.map((p) => (
          <div
            key={p.title}
            className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5"
          >
            <div className="w-9 h-9 rounded-lg bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 flex items-center justify-center">
              <p.icon className="w-4.5 h-4.5" />
            </div>
            <h3 className="mt-3 font-medium text-gray-900 dark:text-gray-100">{p.title}</h3>
            <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">{p.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
