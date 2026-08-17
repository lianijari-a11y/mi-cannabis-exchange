"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Active-route indicator — the plain hover-only nav gave no way to tell
// which page you're on. Needs usePathname(), hence split out as its own
// small client component while PortalShell itself stays server-rendered.
export function PortalNav({
  navItems,
  variant,
}: {
  navItems: { href: string; label: string }[];
  variant: "desktop" | "mobile";
}) {
  const pathname = usePathname();

  if (variant === "mobile") {
    return (
      <nav className="sm:hidden flex items-center gap-4 text-xs px-4 pb-2 overflow-x-auto">
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`whitespace-nowrap pb-1 border-b-2 ${
                active
                  ? "border-primary text-ink font-medium"
                  : "border-transparent text-ink-muted"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    // A nav this long (e.g. Admin's 8 items) can genuinely overflow even on
    // a real desktop viewport — scrolls within its own box (same graceful-
    // overflow idea as the mobile nav below) rather than breaking the
    // header layout. The mask fade is the visual cue that there's more to
    // scroll to, since the scrollbar itself is hidden for a cleaner look.
    <div
      className="hidden sm:block min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{ maskImage: "linear-gradient(to right, black calc(100% - 20px), transparent 100%)" }}
    >
      <nav className="flex items-center gap-0.5 text-sm w-max pr-5">
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`px-2 py-1 rounded-lg whitespace-nowrap transition-colors ${
                active
                  ? "text-ink font-medium bg-surface-muted"
                  : "text-ink-muted hover:text-ink hover:bg-surface-muted"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
