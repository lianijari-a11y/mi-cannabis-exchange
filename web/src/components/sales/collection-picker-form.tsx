"use client";

import { useState } from "react";

type MenuOption = {
  batchId: string;
  sellerName: string;
  createdAt: Date | string;
  productCount: number;
  activeCount: number;
};

export function CollectionPickerForm({
  menus,
  action,
  children,
}: {
  menus: MenuOption[];
  action: (formData: FormData) => void;
  children?: React.ReactNode;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [acknowledged, setAcknowledged] = useState(false);

  function toggle(batchId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(batchId)) next.delete(batchId);
      else next.add(batchId);
      return next;
    });
  }

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        {menus.map((m) => (
          <label
            key={m.batchId}
            className="flex items-center gap-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 cursor-pointer"
          >
            <input
              type="checkbox"
              name="batchId"
              value={m.batchId}
              checked={selected.has(m.batchId)}
              onChange={() => toggle(m.batchId)}
              className="w-4 h-4"
            />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{m.sellerName}</p>
              <p className="text-[11px] text-gray-400">
                {new Date(m.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                {" · "}
                {m.activeCount} active product{m.activeCount === 1 ? "" : "s"}
              </p>
            </div>
          </label>
        ))}
      </div>

      {children}

      <label className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-300">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
          className="w-4 h-4 mt-0.5"
        />
        I have read and understand the terms disclaimer above.
      </label>

      <button
        type="submit"
        disabled={selected.size === 0 || !acknowledged}
        className="bg-green-700 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        Create link ({selected.size} menu{selected.size === 1 ? "" : "s"})
      </button>
    </form>
  );
}
