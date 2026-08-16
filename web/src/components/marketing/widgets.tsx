// Small reusable "console" pieces used to build the marketing page's
// dashboard-mockup widgets. Everything here is illustrative UI chrome, not
// wired to real data — see the callers for the illustrative copy.

export function LiveDot({ className = "" }: { className?: string }) {
  return (
    <span className={`relative flex h-2 w-2 ${className}`}>
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
    </span>
  );
}

export function ConsolePanel({
  title,
  live,
  children,
  className = "",
}: {
  title: string;
  live?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-gray-800 bg-gray-950 shadow-2xl shadow-black/40 overflow-hidden ${className}`}
    >
      <div className="flex items-center justify-between border-b border-gray-800 bg-gray-900/60 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-green-500/70" />
          <span className="ml-2 text-[11px] font-medium uppercase tracking-wide text-gray-400">
            {title}
          </span>
        </div>
        {live && (
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-green-400">
            <LiveDot />
            Live
          </div>
        )}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export function StatTile({
  label,
  value,
  sub,
  icon,
  tone = "light",
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ReactNode;
  tone?: "light" | "dark";
}) {
  if (tone === "dark") {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900/80 p-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-wide text-gray-500">{label}</p>
          {icon && <span className="text-gray-600">{icon}</span>}
        </div>
        <p className="mt-1 text-xl font-semibold text-gray-100">{value}</p>
        {sub && <p className="text-[10px] text-gray-500">{sub}</p>}
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
          {label}
        </p>
        {icon && <span className="text-green-700 dark:text-green-400">{icon}</span>}
      </div>
      <p className="mt-1 text-xl font-semibold text-gray-900 dark:text-gray-100">{value}</p>
      {sub && <p className="text-[10px] text-gray-400 dark:text-gray-500">{sub}</p>}
    </div>
  );
}

export function Pill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "green" | "amber" | "blue";
}) {
  const tones: Record<string, string> = {
    neutral: "bg-gray-800 text-gray-300",
    green: "bg-green-900/50 text-green-400",
    amber: "bg-amber-900/40 text-amber-400",
    blue: "bg-blue-900/40 text-blue-400",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}
