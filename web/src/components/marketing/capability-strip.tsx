import { Infinity, Eye, FileText, Truck, Sparkles, LineChart, ShoppingCart, Gift } from "lucide-react";

const CAPABILITIES = [
  { icon: Infinity, label: "Unlimited counter-offer rounds" },
  { icon: Eye, label: "100% broker visibility on every deal" },
  { icon: FileText, label: "Invoice auto-generated at acceptance" },
  { icon: Truck, label: "Shipment tracked step by step" },
  { icon: Sparkles, label: "AI-assisted listing drafts" },
  { icon: LineChart, label: "Live market pulse pricing" },
  { icon: ShoppingCart, label: "Xcelerate POS retail register" },
  { icon: Gift, label: "Customer loyalty & purchase habits" },
];

export function CapabilityStrip() {
  return (
    <div className="border-y border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/60">
      <div className="max-w-6xl mx-auto px-4 py-4 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
        {CAPABILITIES.map((c) => (
          <div
            key={c.label}
            className="flex items-center gap-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400"
          >
            <c.icon className="w-4 h-4 text-green-700 dark:text-green-400 shrink-0" />
            {c.label}
          </div>
        ))}
      </div>
    </div>
  );
}
