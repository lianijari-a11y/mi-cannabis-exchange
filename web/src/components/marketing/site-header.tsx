import Link from "next/link";
import { Leaf } from "lucide-react";

const NAV_LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#roles", label: "Roles" },
  { href: "#compliance", label: "Trust & compliance" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-950/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-gray-950/60">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 bg-green-700 rounded-lg flex items-center justify-center shrink-0">
            <Leaf className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-sm sm:text-base text-gray-900 dark:text-gray-100 whitespace-nowrap">
            MI Cannabis Exchange
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors whitespace-nowrap"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-3 text-sm shrink-0">
          <Link
            href="/login"
            className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 px-1.5 sm:px-2 py-1.5 transition-colors whitespace-nowrap"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="bg-green-700 hover:bg-green-800 text-white rounded-lg px-3 sm:px-3.5 py-1.5 font-medium transition-colors whitespace-nowrap"
          >
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}
