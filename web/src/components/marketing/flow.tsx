import { PackagePlus, MessagesSquare, FileCheck2, Truck } from "lucide-react";

const STEPS = [
  {
    icon: PackagePlus,
    title: "Post",
    body: "Grower, Processor, or Broker lists inventory — strain, category, THC%, quantity, price, and terms. It's visible to every retailer the instant it's posted.",
  },
  {
    icon: MessagesSquare,
    title: "Negotiate, blind",
    body: "A retailer accepts as-is or counters on price and terms. Either side can counter again, as many rounds as it takes — neither ever sees who's on the other end.",
  },
  {
    icon: FileCheck2,
    title: "Accept & invoice",
    body: "Accepting creates a Deal and an invoice generates automatically. The retailer reviews it, accepts, and picks a transporter — preferred one pre-selected.",
  },
  {
    icon: Truck,
    title: "Transport & deliver",
    body: "The assigned transporter moves the shipment through assigned → picked up → in transit → delivered, one step at a time, visible to everyone on the deal.",
  },
];

export function Flow() {
  return (
    <section id="how-it-works" className="max-w-6xl mx-auto px-4 py-20 scroll-mt-16">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-green-700 dark:text-green-400">
          How it works
        </p>
        <h2 className="mt-2 text-3xl font-semibold text-gray-900 dark:text-gray-100">
          One flow, from listing to delivery
        </h2>
        <p className="mt-3 text-gray-600 dark:text-gray-400">
          No platform-assigned matching, no ranking a listing based on the platform&apos;s own
          interest — it&apos;s a bulletin board. Every deal that closes is a decision the two
          negotiating parties made themselves.
        </p>
      </div>

      <div className="mt-12 relative grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div
          aria-hidden
          className="hidden lg:block absolute top-6 left-[12.5%] right-[12.5%] h-px bg-gray-200 dark:bg-gray-800"
        />
        {STEPS.map((step, i) => (
          <div key={step.title} className="relative">
            <div className="flex items-center gap-3 lg:block">
              <div className="relative z-10 w-12 h-12 rounded-xl bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 flex items-center justify-center text-green-700 dark:text-green-400 shrink-0">
                <step.icon className="w-5 h-5" />
              </div>
              <p className="lg:hidden text-sm font-mono text-gray-400 dark:text-gray-600">
                Step {i + 1}
              </p>
            </div>
            <p className="hidden lg:block mt-4 text-xs font-mono text-gray-400 dark:text-gray-600">
              Step {i + 1}
            </p>
            <h3 className="mt-1 lg:mt-1 font-semibold text-gray-900 dark:text-gray-100">
              {step.title}
            </h3>
            <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">{step.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
