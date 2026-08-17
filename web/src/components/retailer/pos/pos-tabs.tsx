"use client";

import { useState, type ReactNode } from "react";

const TABS = [
  { key: "register", label: "Register" },
  { key: "orders", label: "Orders" },
  { key: "intake", label: "Intake" },
  { key: "inventory", label: "Inventory" },
  { key: "history", label: "Sales history" },
  { key: "marketing", label: "Marketing" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function PosTabs({
  register,
  orders,
  intake,
  inventory,
  history,
  marketing,
}: Record<TabKey, ReactNode>) {
  const [active, setActive] = useState<TabKey>("register");
  const panels: Record<TabKey, ReactNode> = { register, orders, intake, inventory, history, marketing };

  return (
    <div>
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800 mb-4 print:hidden">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActive(tab.key)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
              active === tab.key
                ? "border-green-700 text-green-700 dark:text-green-400"
                : "border-transparent text-gray-500 dark:text-gray-400"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {panels[active]}
    </div>
  );
}
