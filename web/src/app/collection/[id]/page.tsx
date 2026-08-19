import { auth } from "@/auth";
import { publicCollectionView } from "@/lib/menu-collections";
import { CartBuilder } from "@/components/cart/cart-builder";

// Shareable multi-menu collection link (CLAUDE.md §40) — "an account rep
// has 14 menus from 14 different growers, all 14 can be grouped and
// shared with one link." Same public boundary as /menu/[batchId]: no
// session required to browse, anonymized handles only, and only
// currently-shareable listings show up at all.
export default async function PublicCollectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [collection, session] = await Promise.all([publicCollectionView(id), auth()]);

  if (!collection) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
        <div className="text-center">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            This collection isn&apos;t available
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Everything in it may have closed, expired, or been restricted to specific retailers.
          </p>
        </div>
      </div>
    );
  }

  const totalProducts = collection.sellers.reduce((n, s) => n + s.listings.length, 0);

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
        <h1 className="mb-5 text-xl font-semibold text-gray-900 dark:text-gray-100">
          {totalProducts} product{totalProducts === 1 ? "" : "s"} across {collection.sellers.length}{" "}
          seller{collection.sellers.length === 1 ? "" : "s"}
        </h1>

        <CartBuilder
          sellers={collection.sellers}
          collectionId={id}
          sessionRole={session?.user?.role ?? null}
        />
      </main>
    </div>
  );
}
