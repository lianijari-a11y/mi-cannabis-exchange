import Link from "next/link";
import {
  ArrowRight,
  ShieldCheck,
  Radar,
  Package,
  Handshake,
  Truck,
} from "lucide-react";
import { ConsolePanel, StatTile, Pill, LiveDot } from "./widgets";

const FEED_ROWS = [
  { handle: "Grower #A17", category: "Flower", detail: "22.4% THC · $1,450/lb · Cash" },
  { handle: "Processor #C04", category: "Vape", detail: "1g carts · $9.50/unit · Net-30" },
  { handle: "Broker #B02", category: "Concentrate", detail: "Live resin · $28/g · Negotiable" },
];

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* ambient glow — pure CSS blurred shapes, no external assets */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden opacity-60 dark:opacity-80"
      >
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[640px] h-[320px] rounded-full bg-green-500/10 dark:bg-green-500/15 blur-3xl" />
        <div className="absolute -top-10 right-0 w-[360px] h-[220px] rounded-full bg-green-700/10 dark:bg-green-400/10 blur-3xl" />
      </div>

      <div className="max-w-6xl mx-auto px-4 pt-14 pb-20 lg:pt-20 lg:pb-28 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-green-700/30 bg-green-50 dark:bg-green-900/20 px-3 py-1 text-xs font-medium text-green-700 dark:text-green-400">
            <LiveDot />
            Built for Michigan-licensed operators
          </div>

          <h1 className="mt-5 text-4xl sm:text-5xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
            The command post for Michigan&apos;s wholesale cannabis trade
          </h1>

          <p className="mt-5 text-lg text-gray-600 dark:text-gray-400 max-w-xl">
            Growers, processors, retailers, and brokers run every listing, negotiation,
            invoice, and shipment through one blind, broker-mediated exchange — built around
            how Michigan&apos;s licensed wholesale market actually moves product.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white rounded-lg px-5 py-3 font-medium transition-colors"
            >
              Get started
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-900 rounded-lg px-5 py-3 font-medium transition-colors"
            >
              Sign in
            </Link>
          </div>

          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-green-700 dark:text-green-400" />
              Identities blind, always
            </span>
            <span className="flex items-center gap-1.5">
              <Handshake className="w-4 h-4 text-green-700 dark:text-green-400" />
              Broker sees every deal
            </span>
            <span className="flex items-center gap-1.5">
              <Truck className="w-4 h-4 text-green-700 dark:text-green-400" />
              Secure-transporter fulfillment
            </span>
          </div>
        </div>

        <div className="relative">
          <ConsolePanel title="exchange · ops console" live>
            <div className="grid grid-cols-2 gap-2.5">
              <StatTile label="Active listings" value="128" tone="dark" icon={<Package className="w-3.5 h-3.5" />} />
              <StatTile label="Open negotiations" value="34" tone="dark" icon={<Handshake className="w-3.5 h-3.5" />} />
              <StatTile label="Counter-rounds" value="Unlimited" tone="dark" icon={<Radar className="w-3.5 h-3.5" />} />
              <StatTile label="Shipments in transit" value="9" tone="dark" icon={<Truck className="w-3.5 h-3.5" />} />
            </div>

            <div className="mt-4">
              <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-2">
                Retailer feed · anonymized
              </p>
              <div className="space-y-1.5">
                {FEED_ROWS.map((row) => (
                  <div
                    key={row.handle}
                    className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/70 px-3 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Pill tone="green">{row.category}</Pill>
                      <span className="text-xs font-medium text-gray-200 truncate">
                        {row.handle}
                      </span>
                    </div>
                    <span className="text-[11px] text-gray-500 whitespace-nowrap hidden sm:inline">
                      {row.detail}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <p className="mt-3 text-[10px] text-gray-600">
              Illustrative preview — actual listings and figures appear once you sign in.
            </p>
          </ConsolePanel>
        </div>
      </div>
    </section>
  );
}
