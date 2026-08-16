import { posConnectionFor } from "@/lib/pos-integration";
import { POS_VENDORS, POS_VENDOR_LABELS } from "@/lib/pos-integration";

export async function PosSettings({
  sellerId,
  connectAction,
  disconnectAction,
}: {
  sellerId: string;
  connectAction: (formData: FormData) => void;
  disconnectAction: (formData: FormData) => void;
}) {
  const connection = await posConnectionFor(sellerId);

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 space-y-3 max-w-md">
      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">POS integration</h2>
      <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900 rounded-lg p-2">
        Not live yet — this platform isn&apos;t a certified API partner with any of these POS
        vendors, so nothing actually syncs. Connecting here just stores your key and records
        what a sync would have done, so it&apos;s ready to switch on for real once that partner
        access exists.
      </p>

      {connection && (
        <p className="text-xs text-gray-600 dark:text-gray-400">
          Connected to {POS_VENDOR_LABELS[connection.vendor as keyof typeof POS_VENDOR_LABELS] ?? connection.vendor} —
          auto-sync {connection.autoSyncEnabled ? "on" : "off"}
        </p>
      )}

      <form action={connectAction} className="space-y-2">
        <select
          name="vendor"
          defaultValue={connection?.vendor ?? POS_VENDORS[0]}
          className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1.5 text-xs bg-transparent"
        >
          {POS_VENDORS.map((v) => (
            <option key={v} value={v}>
              {POS_VENDOR_LABELS[v]}
            </option>
          ))}
        </select>
        <input
          name="apiKey"
          placeholder="API key"
          defaultValue={connection?.apiKey ?? ""}
          className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1.5 text-xs bg-transparent"
        />
        <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
          <input type="checkbox" name="autoSyncEnabled" defaultChecked={connection?.autoSyncEnabled ?? false} />
          Auto-sync accepted deals
        </label>
        <div className="flex gap-2">
          <button type="submit" className="bg-green-700 text-white rounded-lg px-3 py-1.5 text-xs font-medium">
            {connection ? "Update" : "Connect"}
          </button>
          {connection && (
            <button
              formAction={disconnectAction}
              className="border border-red-300 dark:border-red-800 text-red-600 rounded-lg px-3 py-1.5 text-xs font-medium"
            >
              Disconnect
            </button>
          )}
        </div>
      </form>

      {connection && connection.syncLogs.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">Recent sync attempts</p>
          <ul className="space-y-1 text-[11px] text-gray-500 dark:text-gray-400">
            {connection.syncLogs.map((log) => (
              <li key={log.id}>
                {new Date(log.createdAt).toLocaleString()} — {log.status}: {log.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
