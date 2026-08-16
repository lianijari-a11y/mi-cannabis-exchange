import Link from "next/link";
import { Leaf, LogOut } from "lucide-react";
import { logout } from "@/app/actions";
import { NotificationBell } from "@/components/notification-bell";

export function PortalShell({
  roleLabel,
  navItems,
  children,
}: {
  roleLabel: string;
  navItems: { href: string; label: string }[];
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-7 h-7 bg-green-700 rounded-lg flex items-center justify-center">
                <Leaf className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                MI Cannabis Exchange
              </span>
            </Link>
            <nav className="hidden sm:flex items-center gap-4 text-sm">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <span className="text-xs text-gray-400 dark:text-gray-500">{roleLabel}</span>
            <form action={logout}>
              <button
                type="submit"
                className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                aria-label="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
        <nav className="sm:hidden flex items-center gap-4 text-xs px-4 pb-2 overflow-x-auto">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="text-gray-600 dark:text-gray-300 whitespace-nowrap">
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
