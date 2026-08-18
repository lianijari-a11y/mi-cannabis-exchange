import {
  Sprout,
  FlaskConical,
  Store,
  Handshake,
  Truck,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Star,
  Filter,
  MapPin,
  CheckCircle2,
  Circle,
  Wallet,
  ClipboardCheck,
  AlertTriangle,
  Headset,
  Phone,
} from "lucide-react";
import { ConsolePanel, Pill } from "./widgets";

function RoleRow({
  icon: Icon,
  eyebrow,
  title,
  body,
  bullets,
  mockup,
  reverse,
}: {
  icon: React.ComponentType<{ className?: string }>;
  eyebrow: string;
  title: string;
  body: string;
  bullets: string[];
  mockup: React.ReactNode;
  reverse?: boolean;
}) {
  return (
    <div
      className={`grid lg:grid-cols-2 gap-10 lg:gap-16 items-center py-14 border-t border-gray-200 dark:border-gray-800 first:border-t-0 first:pt-0`}
    >
      <div className={reverse ? "lg:order-2" : ""}>
        <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 flex items-center justify-center">
          <Icon className="w-5 h-5" />
        </div>
        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-green-700 dark:text-green-400">
          {eyebrow}
        </p>
        <h3 className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
        <p className="mt-3 text-gray-600 dark:text-gray-400">{body}</p>
        <ul className="mt-5 space-y-2.5">
          {bullets.map((b) => (
            <li key={b} className="flex items-start gap-2.5 text-sm text-gray-700 dark:text-gray-300">
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-green-700 dark:text-green-400" />
              {b}
            </li>
          ))}
        </ul>
      </div>
      <div className={reverse ? "lg:order-1" : ""}>{mockup}</div>
    </div>
  );
}

function SellerMockup() {
  return (
    <ConsolePanel title="grower/processor · listing draft">
      <div className="rounded-lg border border-dashed border-gray-700 bg-gray-900/50 p-3">
        <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-gray-500">
          <Sparkles className="w-3 h-3" /> Pasted notes
        </p>
        <p className="mt-1.5 text-xs text-gray-400 leading-relaxed">
          &ldquo;got 40lb blue dream trimmed nice 21-23% thc looking for 1400 a lb cash or will
          do net30&rdquo;
        </p>
      </div>
      <div className="flex justify-center py-2 text-gray-600">
        <ArrowRight className="w-4 h-4 rotate-90" />
      </div>
      <div className="rounded-lg border border-gray-800 bg-gray-900/70 p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-100">Blue Dream</span>
          <Pill tone="green">Flower</Pill>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-[10px] text-gray-500">THC</p>
            <p className="text-xs font-medium text-gray-200">22%</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-500">Qty</p>
            <p className="text-xs font-medium text-gray-200">40 lb</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-500">Price</p>
            <p className="text-xs font-medium text-gray-200">$1,400/lb</p>
          </div>
        </div>
        <p className="mt-2 text-[10px] text-gray-500">Terms: Cash or Net-30 · draft — review to post</p>
      </div>
    </ConsolePanel>
  );
}

function RetailerMockup() {
  return (
    <ConsolePanel title="retailer · marketplace feed" live>
      <div className="flex items-center gap-2 mb-3">
        <Filter className="w-3.5 h-3.5 text-gray-500" />
        <Pill>Flower</Pill>
        <Pill>Under $1,500</Pill>
        <Pill>Cash</Pill>
      </div>
      <div className="space-y-2">
        {[
          { h: "Grower #A17", d: "22% THC · $1,400/lb", w: false },
          { h: "Grower #F03", d: "18% THC · $1,150/lb", w: true },
          { h: "Broker #B02", d: "Live resin · $28/g", w: false },
        ].map((row) => (
          <div
            key={row.h}
            className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/70 px-3 py-2"
          >
            <div>
              <p className="text-xs font-medium text-gray-200">{row.h}</p>
              <p className="text-[10px] text-gray-500">{row.d}</p>
            </div>
            <Star
              className={`w-3.5 h-3.5 ${row.w ? "fill-amber-400 text-amber-400" : "text-gray-700"}`}
            />
          </div>
        ))}
      </div>
      <p className="mt-3 text-[10px] text-gray-600">
        Every poster shown as an anonymous handle — never a real business name.
      </p>
    </ConsolePanel>
  );
}

function BrokerMockup() {
  return (
    <ConsolePanel title="broker · deal detail" live>
      <div className="rounded-lg border border-gray-800 bg-gray-900/70 p-3">
        <div className="flex items-center justify-between">
          <Pill tone="blue">Real identity</Pill>
          <Pill tone="green">Open</Pill>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="text-[10px] text-gray-500">Seller</p>
            <p className="font-medium text-gray-200">Cultivator LLC</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-500">Retailer</p>
            <p className="font-medium text-gray-200">Retail Group Inc</p>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-gray-800 pt-3">
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <Wallet className="w-3.5 h-3.5" /> Commission
          </div>
          <span className="text-xs font-medium text-gray-200">4% · split</span>
        </div>
      </div>
      <p className="mt-3 text-[10px] text-gray-600">
        Every negotiation on the platform, in real identity, from a phone.
      </p>
    </ConsolePanel>
  );
}

function TransporterMockup() {
  const steps = ["Assigned", "Picked up", "In transit", "Delivered"];
  const active = 2;
  return (
    <ConsolePanel title="transporter · shipment">
      <div className="rounded-lg border border-gray-800 bg-gray-900/70 p-3 space-y-1.5">
        <div className="flex items-center gap-1.5 text-xs text-gray-300">
          <MapPin className="w-3.5 h-3.5 text-gray-500" /> Cultivator LLC — Grand Rapids, MI
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-300">
          <MapPin className="w-3.5 h-3.5 text-gray-500" /> Retail Group Inc — Detroit, MI
        </div>
      </div>
      <div className="mt-4 flex items-center">
        {steps.map((s, i) => (
          <div key={s} className="flex-1 flex items-center last:flex-none">
            <div className="flex flex-col items-center gap-1">
              {i <= active ? (
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              ) : (
                <Circle className="w-4 h-4 text-gray-700" />
              )}
              <span
                className={`text-[9px] whitespace-nowrap ${i <= active ? "text-gray-300" : "text-gray-600"}`}
              >
                {s}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`h-px flex-1 mx-1 ${i < active ? "bg-green-600" : "bg-gray-800"}`}
              />
            )}
          </div>
        ))}
      </div>
      <p className="mt-4 text-[10px] text-gray-600">
        Real business names for pickup/delivery — one status step at a time, no skipping ahead.
      </p>
    </ConsolePanel>
  );
}

function AccountExecMockup() {
  return (
    <ConsolePanel title="account executive · marketing suite" live>
      <div className="rounded-lg border border-amber-900/40 bg-amber-950/20 p-3">
        <div className="flex items-center gap-1.5 text-xs text-amber-400">
          <AlertTriangle className="w-3.5 h-3.5" /> Low stock alert
        </div>
        <p className="mt-1 text-xs text-gray-300">Retail Group Inc is low on Blue Dream (Flower)</p>
      </div>
      <div className="mt-3 space-y-1.5">
        {[
          { name: "Northside Provisions", d: "Grower lead · called 3x", icon: Phone },
          { name: "Great Lakes Dispensary", d: "Callback tomorrow 2pm", icon: Headset },
        ].map((row) => (
          <div
            key={row.name}
            className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/70 px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <row.icon className="w-3.5 h-3.5 text-gray-500" />
              <div>
                <p className="text-xs font-medium text-gray-200">{row.name}</p>
                <p className="text-[10px] text-gray-500">{row.d}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[10px] text-gray-600">
        Every active retailer, every lead, one dashboard — mobile-first, same tier as Broker.
      </p>
    </ConsolePanel>
  );
}

function AdminMockup() {
  return (
    <ConsolePanel title="admin · verification queue">
      <div className="space-y-2">
        <div className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/70 px-3 py-2">
          <div>
            <p className="text-xs font-medium text-gray-200">Cultivator LLC</p>
            <p className="text-[10px] text-gray-500">Grower license · pending</p>
          </div>
          <div className="flex gap-1.5">
            <span className="rounded-md bg-green-900/50 text-green-400 text-[10px] px-2 py-1">
              Approve
            </span>
            <span className="rounded-md bg-gray-800 text-gray-400 text-[10px] px-2 py-1">
              Reject
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-amber-900/40 bg-amber-950/20 px-3 py-2">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            <p className="text-xs text-amber-400">License expires in 12 days</p>
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-1.5 text-[10px] text-gray-600">
        <ClipboardCheck className="w-3.5 h-3.5" /> Every license reviewed by a human before approval.
      </div>
    </ConsolePanel>
  );
}

export function Roles() {
  return (
    <section id="roles" className="border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950/50 scroll-mt-16">
      <div className="max-w-6xl mx-auto px-4 py-20">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-green-700 dark:text-green-400">
            Seven roles, one exchange
          </p>
          <h2 className="mt-2 text-3xl font-semibold text-gray-900 dark:text-gray-100">
            A dedicated portal for every seat at the table
          </h2>
          <p className="mt-3 text-gray-600 dark:text-gray-400">
            Each role gets exactly the visibility it needs — no more, no less.
          </p>
        </div>

        <div className="mt-4">
          <RoleRow
            icon={Sprout}
            eyebrow="Grower & Processor"
            title="Post inventory in minutes, not paperwork"
            body="List flower, concentrates, vapes, or edibles with photos and video. Paste rough notes and let AI draft the structured listing — you always review and post it yourself."
            bullets={[
              "Strain/product, category, THC%, quantity, price, and terms in one form",
              "AI-assisted quick upload turns pasted notes into a pre-filled draft",
              "Market Pulse shows the going rate for your category before you price",
              "Respond to incoming offers and counters from your dashboard",
            ]}
            mockup={<SellerMockup />}
          />
          <RoleRow
            icon={Store}
            eyebrow="Retailer"
            title="One consistent catalog, however rough the source"
            body="Browse every active listing platform-wide through a single, standardized card layout. Filter, sort, watchlist, and negotiate — all while the seller stays anonymous."
            bullets={[
              "Every listing renders the same way, regardless of how it was posted",
              "Accept as-is or counter on price and terms, back and forth",
              "Watchlist a listing without committing to an offer",
              "Review the auto-generated invoice and pick your transporter",
            ]}
            mockup={<RetailerMockup />}
            reverse
          />
          <RoleRow
            icon={Handshake}
            eyebrow="Broker"
            title="Full visibility, mobile-first"
            body="Every negotiation and every closed deal, platform-wide, in real identity on both sides — because the broker is the platform's own intermediary, not a competing outside agent."
            bullets={[
              "See every active thread and closed Deal without joining or being added",
              "Set commission terms — rate and payer — on any deal",
              "Deal cards surface invoice, shipment, and transporter status at a glance",
              "Built mobile-first for checking the whole book from a phone",
            ]}
            mockup={<BrokerMockup />}
          />
          <RoleRow
            icon={Truck}
            eyebrow="Transporter"
            title="Real pickup and delivery details, nothing else"
            body="Michigan Secure Transporter-licensed carriers see the real business name and address on both ends of an assigned shipment — nothing about the negotiation that got them there."
            bullets={[
              "Real Grower/Processor and Retailer identity for logistics only",
              "Step through assigned → picked up → in transit → delivered",
              "Proof-of-delivery upload required to close out a shipment",
              "No access to the listing feed or negotiation history",
            ]}
            mockup={<TransporterMockup />}
            reverse
          />
          <RoleRow
            icon={Headset}
            eyebrow="Account Executive"
            title="Solicit growers, watch inventory, close the loop"
            body="Same trust tier as Broker — platform staff, not a licensed cultivator. Builds listings on behalf of a grower or processor they've signed, and gets pinged the moment a retailer's shelf runs low."
            bullets={[
              "Own lead CRM: call logging, dispositions, callback calendar, dashboard",
              "Notified the instant any retailer's POS inventory crosses a low-stock threshold",
              "Post a listing under the seller's real identity — audit trail only, never shown to buyers",
              "Commission rate set by Admin, computed automatically at product acceptance",
            ]}
            mockup={<AccountExecMockup />}
          />
          <RoleRow
            icon={ShieldCheck}
            eyebrow="Admin"
            title="Keep the exchange licensed and healthy"
            body="Review submitted license numbers and types, approve or reject, and keep an eye on who's coming up for renewal — across every licensed role on the platform."
            bullets={[
              "License verification queue for Grower/Processor/Retailer/Transporter",
              "Full user list and status at a glance",
              "Flags on any license expiring within 90 days",
              "Sets the platform's preferred default transporter",
            ]}
            mockup={<AdminMockup />}
          />
        </div>
      </div>
    </section>
  );
}
