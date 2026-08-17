import { connectSmsAction, disconnectSmsAction, sendSpecialsAction } from "@/app/retailer/pos/actions";

type Connection = { accountSid: string; authToken: string; fromPhoneNumber: string; connectedAt: Date } | null;
type Message = {
  id: string;
  body: string;
  recipientCount: number;
  status: string;
  message: string;
  createdAt: Date;
};

// SCAFFOLDING ONLY — see CLAUDE.md §29. sendSpecialsAction never makes a
// live Twilio call, regardless of whether a connection is on file below —
// every attempt is logged as "stub_only", visible in the history list.
export function MarketingPanel({
  connection,
  optedInCount,
  messages,
}: {
  connection: Connection;
  optedInCount: number;
  messages: Message[];
}) {
  return (
    <div className="max-w-2xl space-y-4">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Twilio connection</h2>
        <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900 rounded-lg p-2">
          Scaffolding only — this app doesn&apos;t send real texts yet, connected or not. Credentials are
          stored so the connection is ready the moment a live integration is built.
        </p>
        <form action={connectSmsAction} className="space-y-2">
          <input
            name="accountSid"
            placeholder="Twilio Account SID"
            defaultValue={connection?.accountSid ?? ""}
            className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1.5 text-xs bg-transparent"
          />
          <input
            name="authToken"
            placeholder={connection ? "Leave blank to keep current Auth Token" : "Twilio Auth Token"}
            className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1.5 text-xs bg-transparent"
          />
          <input
            name="fromPhoneNumber"
            placeholder="From number (e.g. +18135551234)"
            defaultValue={connection?.fromPhoneNumber ?? ""}
            className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1.5 text-xs bg-transparent"
          />
          <div className="flex gap-2">
            <button type="submit" className="bg-green-700 text-white rounded-lg px-3 py-1.5 text-xs font-medium">
              {connection ? "Update" : "Connect"}
            </button>
            {connection && (
              <button
                formAction={disconnectSmsAction}
                className="border border-red-300 dark:border-red-800 text-red-600 rounded-lg px-3 py-1.5 text-xs font-medium"
              >
                Disconnect
              </button>
            )}
          </div>
        </form>
        {connection && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Key on file ({connection.authToken}) — connected {connection.connectedAt.toISOString().slice(0, 10)}
          </p>
        )}
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Send today&apos;s specials</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          <span className="font-medium text-gray-900 dark:text-gray-100">{optedInCount}</span> customer
          {optedInCount === 1 ? "" : "s"} opted in to marketing texts at checkout — only they&apos;d be
          included.
        </p>
        <form action={sendSpecialsAction} className="space-y-2">
          <textarea
            name="body"
            required
            rows={3}
            placeholder="e.g. 20% off all flower today only, mention this text!"
            className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1.5 text-xs bg-transparent"
          />
          <button type="submit" className="bg-green-700 text-white rounded-lg px-3 py-1.5 text-xs font-medium">
            Send
          </button>
        </form>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Message history</h2>
        {messages.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Nothing sent yet.</p>
        ) : (
          <div className="space-y-2">
            {messages.map((m) => (
              <div
                key={m.id}
                className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-xs"
              >
                <p className="text-gray-900 dark:text-gray-100">{m.body}</p>
                <p className="text-gray-400 mt-1">
                  {new Date(m.createdAt).toLocaleString()} · {m.recipientCount} opted-in customer
                  {m.recipientCount === 1 ? "" : "s"}
                </p>
                <p className="text-amber-600 dark:text-amber-400 mt-1">{m.message}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
