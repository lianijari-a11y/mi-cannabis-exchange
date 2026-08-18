import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function FinalCta() {
  return (
    <section className="max-w-6xl mx-auto px-4 py-20">
      <div className="relative overflow-hidden rounded-2xl border border-gray-800 bg-gray-950 px-6 py-16 sm:px-16 text-center">
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[260px] rounded-full bg-green-500/10 blur-3xl" />
        </div>
        <div className="relative">
          <h2 className="text-3xl sm:text-4xl font-semibold text-gray-100 max-w-xl mx-auto">
            Bring your operation onto the exchange
          </h2>
          <p className="mt-4 text-gray-400 max-w-md mx-auto">
            Free to sign up. Grower, Processor, Retailer, and Transporter accounts go through
            license verification before they can trade.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white rounded-lg px-6 py-3 font-medium transition-colors"
            >
              Get started
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 border border-gray-700 text-gray-300 hover:bg-gray-900 rounded-lg px-6 py-3 font-medium transition-colors"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-gray-200 dark:border-gray-800">
      <div className="max-w-6xl mx-auto px-4 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logos/cannabliz-icon.png" alt="Cannabliz" className="w-6 h-6 rounded-md object-cover" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Cannabliz
          </span>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-600 text-center">
          A wholesale marketplace and retail POS (Xcelerate POS) for Michigan-licensed cannabis
          operators. Not affiliated with the State of Michigan.
        </p>
        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
          <Link href="/login" className="hover:text-gray-900 dark:hover:text-gray-100">
            Sign in
          </Link>
          <Link href="/signup" className="hover:text-gray-900 dark:hover:text-gray-100">
            Sign up
          </Link>
        </div>
      </div>
    </footer>
  );
}
