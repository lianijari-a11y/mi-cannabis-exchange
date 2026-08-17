import Link from "next/link";
import { LogOut } from "lucide-react";
import { logout } from "@/app/actions";
import { NotificationBell } from "@/components/notification-bell";
import { PortalNav } from "@/components/portal-nav";

// Two brands, one app (CLAUDE.md §27): "Cannabliz" for the wholesale
// marketplace side (grower/processor/retailer/broker/admin/account-exec
// portals), "Xcelerate POS" for the retail register (/retailer/pos and the
// public order-ahead storefront). The retailer's other pages stay Cannabliz;
// only the POS section itself switches. Icon marks are the real logo files
// (CLAUDE.md §27/§28), cropped to a square badge — see public/logos/.
const BRANDS = {
  cannabliz: {
    name: "Cannabliz",
    iconSrc: "/logos/cannabliz-icon.png",
  },
  xcelerate: {
    name: "Xcelerate POS",
    iconSrc: "/logos/xcelerate-icon.png",
  },
} as const;

export function PortalShell({
  roleLabel,
  navItems,
  brand = "cannabliz",
  children,
}: {
  roleLabel: string;
  navItems: { href: string; label: string }[];
  brand?: keyof typeof BRANDS;
  children: React.ReactNode;
}) {
  const { name, iconSrc } = BRANDS[brand];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="sticky top-0 z-30 border-b border-border bg-white/85 dark:bg-gray-950/85 backdrop-blur-sm shadow-sm">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <Link href="/" className="flex items-center gap-2.5 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={iconSrc}
                alt={name}
                className="w-8 h-8 rounded-lg object-cover shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
              />
              <span className="font-semibold text-sm text-ink tracking-tight whitespace-nowrap hidden md:inline">
                {name}
              </span>
            </Link>
            <PortalNav navItems={navItems} variant="desktop" />
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <NotificationBell />
            <span className="text-xs text-ink-faint">{roleLabel}</span>
            <form action={logout}>
              <button
                type="submit"
                className="text-ink-muted hover:text-ink transition-colors"
                aria-label="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
        <PortalNav navItems={navItems} variant="mobile" />
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
