import Link from "next/link";
import { auth } from "@/auth";
import { publicListingView } from "@/lib/listings";
import { CATEGORY_LABELS, TERMS_LABELS, type Category, type Terms } from "@/lib/constants";

// Shareable public listing link (CLAUDE.md §36) — the one page in this app
// besides /order/[slug] with no requireRole/session check. Anyone with the
// link can view a listing's details and the seller's anonymized handle;
// they can never see the seller's real identity here, same boundary as the
// logged-in retailer feed. Taking an action (Accept/Counter/Decline) is the
// gate — those links route through /listing/[id]/respond, which requires an
// authenticated Retailer session (or the license-lookup/signup detour) to
// actually do anything.
export default async function PublicListingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const listing = await publicListingView(id);
  const session = await auth();

  if (!listing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
        <div className="text-center">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            This listing isn&apos;t available
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            It may have closed, expired, or been restricted to specific retailers.
          </p>
          <Link href="/" className="text-sm text-green-700 dark:text-green-400 mt-4 inline-block">
            Go to Cannabliz
          </Link>
        </div>
      </div>
    );
  }

  const cover = listing.media[0];
  const isLoggedInRetailer = session?.user?.role === "retailer";
  const isAdmin = session?.user?.role === "admin";

  function respondLink(action: "accept" | "counter" | "decline") {
    return `/listing/${id}/respond?action=${action}`;
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
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
          {cover && (
            <div className="aspect-[16/9] bg-gray-100 dark:bg-gray-800">
              {cover.type === "video" ? (
                <video src={cover.url} controls className="w-full h-full object-cover" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cover.url} alt={listing.strainName} className="w-full h-full object-cover" />
              )}
            </div>
          )}
          <div className="p-5">
            <p className="text-xs text-gray-400">Posted by {listing.postedBy.anonHandle}</p>
            <h1 className="mt-1 text-xl font-semibold text-gray-900 dark:text-gray-100">
              {listing.strainName}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {CATEGORY_LABELS[listing.category as Category]}
              {listing.thcPercent != null ? ` · ${listing.thcPercent}% THC` : ""}
            </p>

            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg bg-gray-50 dark:bg-gray-800 py-2.5">
                <p className="text-[10px] uppercase tracking-wide text-gray-400">Quantity</p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {listing.quantity} {listing.unit}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 dark:bg-gray-800 py-2.5">
                <p className="text-[10px] uppercase tracking-wide text-gray-400">Price</p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  ${listing.pricePerUnit}/{listing.unit}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 dark:bg-gray-800 py-2.5">
                <p className="text-[10px] uppercase tracking-wide text-gray-400">Terms</p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {TERMS_LABELS[listing.terms as Terms]}
                </p>
              </div>
            </div>

            {listing.notes && (
              <p className="mt-4 text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                {listing.notes}
              </p>
            )}

            {error && <p className="mt-4 text-xs text-red-600">{decodeURIComponent(error)}</p>}

            {isAdmin ? (
              <div className="mt-6 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20 p-3">
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  You&apos;re signed in as Admin. To respond on behalf of a retailer who&apos;d rather
                  their broker handle this, use{" "}
                  <Link href={`/listing/${id}/respond?action=accept`} className="underline font-medium">
                    Submit on a retailer&apos;s behalf
                  </Link>
                  .
                </p>
              </div>
            ) : (
              <div className="mt-6 flex flex-wrap gap-2">
                <Link
                  href={respondLink("accept")}
                  className="bg-green-700 hover:bg-green-800 text-white rounded-lg px-4 py-2 text-sm font-medium"
                >
                  Accept
                </Link>
                <Link
                  href={respondLink("counter")}
                  className="border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg px-4 py-2 text-sm font-medium"
                >
                  Counter-offer
                </Link>
                <Link
                  href={respondLink("decline")}
                  className="border border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 rounded-lg px-4 py-2 text-sm font-medium"
                >
                  Decline
                </Link>
              </div>
            )}
            {!isLoggedInRetailer && !isAdmin && (
              <p className="mt-2 text-[11px] text-gray-400">
                Taking any action requires a licensed Retailer account — you&apos;ll be asked for
                your state license number next, which auto-fills your business info.
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
