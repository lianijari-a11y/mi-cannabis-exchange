import Link from "next/link";
import { auth } from "@/auth";
import { publicListingView } from "@/lib/listings";
import { RespondPanel } from "@/components/listing/respond-panel";
import { CATEGORY_LABELS, TERMS_LABELS, type Category, type Terms } from "@/lib/constants";

const ACTION_TITLE: Record<string, string> = {
  accept: "Accept this listing",
  counter: "Counter-offer",
  decline: "Decline this listing",
};

// The gated half of a shared listing link (CLAUDE.md §36) — /listing/[id]
// is the open public view, this page is where clicking Accept/Counter/
// Decline actually lands. No requireRole here either (a not-logged-in
// visitor needs to reach this page to see the sign-in/sign-up choice) —
// RespondPanel is what branches on session state and gates the real write.
export default async function RespondPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ action?: string }>;
}) {
  const { id } = await params;
  const { action: rawAction } = await searchParams;
  const action = rawAction === "counter" || rawAction === "decline" ? rawAction : "accept";

  const [listing, session] = await Promise.all([publicListingView(id), auth()]);

  if (!listing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
        <div className="text-center">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            This listing isn&apos;t available
          </h1>
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
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logos/cannabliz-icon.png" alt="Cannabliz" className="w-7 h-7 rounded-md object-cover" />
          <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">Cannabliz</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <Link href={`/listing/${id}`} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          ← Back to listing
        </Link>

        <div className="mt-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{ACTION_TITLE[action]}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {listing.strainName} · {CATEGORY_LABELS[listing.category as Category]} · {listing.quantity}{" "}
            {listing.unit} · ${listing.pricePerUnit}/{listing.unit} · {TERMS_LABELS[listing.terms as Terms]}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Posted by {listing.postedBy.anonHandle}</p>

          <div className="mt-5">
            <RespondPanel
              listingId={id}
              action={action}
              sessionRole={session?.user?.role ?? null}
              sessionUserId={session?.user?.id ?? null}
              defaultPrice={listing.pricePerUnit}
              defaultTerms={listing.terms}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
