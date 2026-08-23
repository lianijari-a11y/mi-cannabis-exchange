import { UnsubscribeConfirm } from "@/components/unsubscribe/unsubscribe-confirm";
import { confirmUnsubscribeAction } from "./actions";

// Public, no requireRole — the one other page in this app besides
// /listing/[id] and /order/[slug] that a completely anonymous visitor
// reaches, reachable from the unsubscribe link every marketing email
// carries (lib/lead-email.ts's sendEmailToLead).
export default async function UnsubscribePage({
  params,
  searchParams,
}: {
  params: Promise<{ leadId: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { leadId } = await params;
  const { token } = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 space-y-4">
        <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100">Unsubscribe from emails</h1>
        {!token ? (
          <p className="text-sm text-red-600">This link is missing its confirmation code — invalid or corrupted.</p>
        ) : (
          <>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Click below to stop receiving marketing emails from us. This doesn&rsquo;t affect any other way we
              might be in touch.
            </p>
            <UnsubscribeConfirm leadId={leadId} token={token} confirmAction={confirmUnsubscribeAction} />
          </>
        )}
      </div>
    </div>
  );
}
