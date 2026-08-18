import {
  Zap,
  Barcode,
  Gift,
  Percent,
  Gauge,
  Smartphone,
  Radio,
  CheckCircle2,
} from "lucide-react";
import { ConsolePanel, StatTile, Pill } from "./widgets";

const BULLETS = [
  "Scan-to-sell register — pairs with any USB/Bluetooth barcode scanner, no camera required",
  "Loyalty points and per-line discounts, with purchase habits pulled up the moment a regular scans in",
  "A live daily purchase-limit tracker per customer — never a fabricated visit or a structured pickup",
  "Public order-ahead storefront at your own link — customers browse, order, and pay when they collect",
  "Sales submitted to METRC automatically, retried on a rate limit, off the checkout critical path",
];

function RegisterMockup() {
  return (
    <ConsolePanel title="xcelerate pos · register" live>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5 text-xs text-gray-300">
          <Barcode className="w-3.5 h-3.5 text-amber-400" />
          Scan or search…
        </div>
        <Pill tone="amber">Curbside</Pill>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/70 px-3 py-2">
          <div>
            <p className="text-xs font-medium text-gray-200">Blue Dream — 3.5g</p>
            <p className="text-[10px] text-gray-500">$40.00 → $35.00</p>
          </div>
          <Pill tone="amber">-$5 loyalty</Pill>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/70 px-3 py-2">
          <p className="text-xs font-medium text-gray-200">Live Resin Cart — 1g</p>
          <p className="text-xs text-gray-300">$45.00</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <StatTile label="THC total" value="612mg" tone="dark" />
        <StatTile label="Loyalty" value="290 pts" tone="dark" icon={<Gift className="w-3.5 h-3.5" />} />
        <StatTile label="Today" value="16.0 / 2.5 oz" tone="dark" icon={<Gauge className="w-3.5 h-3.5" />} />
      </div>
      <p className="mt-3 text-[10px] text-amber-400/90">
        Regular customer recognized — 12 visits, avg. $118/visit.
      </p>
    </ConsolePanel>
  );
}

export function Xcelerate() {
  return (
    <section
      id="xcelerate-pos"
      className="border-t border-gray-200 dark:border-gray-800 bg-gray-950 scroll-mt-16"
    >
      <div className="max-w-6xl mx-auto px-4 py-20 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 text-gray-950 flex items-center justify-center">
            <Zap className="w-5 h-5" />
          </div>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-amber-400">
            Xcelerate POS
          </p>
          <h2 className="mt-1 text-3xl font-semibold text-gray-100">
            The register for your storefront, built on the same platform
          </h2>
          <p className="mt-3 text-gray-400">
            Once a wholesale deal lands and is delivered, convert it straight into POS inventory
            and start ringing up retail sales — no second system, no re-entering the product.
          </p>
          <ul className="mt-6 space-y-2.5">
            {BULLETS.map((b) => (
              <li key={b} className="flex items-start gap-2.5 text-sm text-gray-300">
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-amber-400" />
                {b}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-xs text-gray-500 flex items-center gap-1.5">
            <Smartphone className="w-3.5 h-3.5" />
            Add-to-home-screen on iPad — its own icon, separate from the Cannabliz app.
          </p>
        </div>
        <RegisterMockup />
      </div>

      <div className="border-t border-gray-900">
        <div className="max-w-6xl mx-auto px-4 py-8 grid sm:grid-cols-3 gap-6 text-center sm:text-left">
          <div className="flex items-center gap-3 justify-center sm:justify-start">
            <Radio className="w-5 h-5 text-amber-400 shrink-0" />
            <p className="text-sm text-gray-400">
              <span className="text-gray-200 font-medium">Live METRC submission</span> on every
              sale, sandbox by default until you're ready
            </p>
          </div>
          <div className="flex items-center gap-3 justify-center sm:justify-start">
            <Percent className="w-5 h-5 text-amber-400 shrink-0" />
            <p className="text-sm text-gray-400">
              <span className="text-gray-200 font-medium">Per-lot markup</span> you set, with a
              live state market-price trend alongside it
            </p>
          </div>
          <div className="flex items-center gap-3 justify-center sm:justify-start">
            <Gift className="w-5 h-5 text-amber-400 shrink-0" />
            <p className="text-sm text-gray-400">
              <span className="text-gray-200 font-medium">Seasonal receipts</span> and an optional
              specials list your customers opt into themselves
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
