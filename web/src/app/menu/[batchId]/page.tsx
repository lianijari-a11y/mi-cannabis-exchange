import Link from "next/link";
import { publicMenuView } from "@/lib/listings";
import { CATEGORY_LABELS, type Category } from "@/lib/constants";

// Shareable public menu link (CLAUDE.md §40) — the whole-batch counterpart
// to /listing/[id] (§36). No requireRole, no session check, same boundary:
// anonymized poster handle only, and only listings that are both
// status "active" and visibility "all" are shown — a batch containing an
// Admin-restricted exclusive listing just quietly omits that one row
// rather than exposing it. Each card links to that listing's own
// /listing/[id] page for the actual Accept/Counter/Decline flow — this
// page is a browse view, not a second negotiation surface.
export default async function PublicMenuPage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = await params;
  const menu = await publicMenuView(batchId);

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
          <Link href="/" className="text-sm text-green-700 dark:text-green-400 mt-4 inline-block">
            Go to Cannabliz
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logos/cannabliz-icon.png" alt="Cannabliz" className="w-7 h-7 rounded-md object-cover" />
          <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">Cannabliz</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <p className="text-xs text-gray-400">Posted by {menu.postedByHandle}</p>
        <h1 className="mt-1 text-xl font-semibold text-gray-900 dark:text-gray-100">
          Menu — {menu.listings.length} product{menu.listings.length === 1 ? "" : "s"}
        </h1>

        <div className="mt-5 grid sm:grid-cols-2 gap-3">
          {menu.listings.map((listing) => {
            const cover = listing.media[0];
            return (
              <Link
                key={listing.id}
                href={`/listing/${listing.id}`}
                className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden hover:border-green-300 dark:hover:border-green-800"
              >
                {cover && (
                  <div className="aspect-[16/9] bg-gray-100 dark:bg-gray-800">
                    {cover.type === "video" ? (
                      // eslint-disable-next-line jsx-a11y/media-has-caption
                      <video src={cover.url} className="w-full h-full object-cover" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cover.url} alt={listing.strainName} className="w-full h-full object-cover" />
                    )}
                  </div>
                )}
                <div className="p-3">
                  <h3 className="font-medium text-sm text-gray-900 dark:text-gray-100">
                    {listing.strainName}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {CATEGORY_LABELS[listing.category as Category] ?? listing.category}
                    {listing.thcPercent != null ? ` · ${listing.thcPercent}% THC` : ""}
                  </p>
                  <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                    {listing.quantity} {listing.unit} · ${listing.pricePerUnit}/{listing.unit}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
