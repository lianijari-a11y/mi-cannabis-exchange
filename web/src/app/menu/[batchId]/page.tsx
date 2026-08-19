import { auth } from "@/auth";
import { publicMenuView } from "@/lib/listings";
import { CartBuilder } from "@/components/cart/cart-builder";

// Shareable public menu link (CLAUDE.md §40) — no requireRole, no session
// check, same boundary as /listing/[id] (§36): anonymized poster handle
// only, and only listings that are both status "active" and visibility
// "all" are shown. A visitor can pick quantities across every product on
// this menu and submit one combined order — see components/cart/cart-builder.tsx
// and lib/cart-orders.ts for how that becomes ordinary per-listing offers
// behind the scenes.
export default async function PublicMenuPage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = await params;
  const [menu, session] = await Promise.all([publicMenuView(batchId), auth()]);

  if (!menu) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
        <div className="text-center">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            This menu isn&apos;t available
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Every product in it may have closed, expired, or been restricted to specific
            retailers.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logos/cannabliz-icon.png" alt="Cannabliz" className="w-7 h-7 rounded-md object-cover" />
          <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">Cannabliz</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <p className="text-xs text-gray-400">Posted by {menu.postedByHandle}</p>
        <h1 className="mt-1 mb-5 text-xl font-semibold text-gray-900 dark:text-gray-100">
          Menu — {menu.listings.length} product{menu.listings.length === 1 ? "" : "s"}
        </h1>

        <CartBuilder
          sellers={[{ anonHandle: menu.postedByHandle, listings: menu.listings }]}
          sessionRole={session?.user?.role ?? null}
          callbackUrl={`/menu/${batchId}`}
        />
      </main>
    </div>
  );
}
