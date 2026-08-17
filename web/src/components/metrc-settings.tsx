import { metrcConnectionFor } from "@/lib/metrc-integration";

export async function MetrcSettings({
  userId,
  connectAction,
  disconnectAction,
}: {
  userId: string;
  connectAction: (formData: FormData) => void;
  disconnectAction: (formData: FormData) => void;
}) {
  const connection = await metrcConnectionFor(userId);

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 space-y-3 max-w-md">
      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
        Michigan METRC connection
      </h2>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Used for real-time inventory tracking (e.g. the Point of Sale register) — Michigan
        requires every retail sale to be reported to METRC&apos;s seed-to-sale system.
      </p>

      {connection && (
        <p className="text-xs text-gray-600 dark:text-gray-400">
          Connected {connection.licenseNumber ? `(license ${connection.licenseNumber})` : ""} — key{" "}
          {connection.userApiKey} — {connection.connectedAt.toISOString().slice(0, 10)}
        </p>
      )}

      <form action={connectAction} className="space-y-2">
        <input
          name="licenseNumber"
          placeholder="Your state license number"
          defaultValue={connection?.licenseNumber ?? ""}
          className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1.5 text-xs bg-transparent"
        />
        <input
          name="userApiKey"
          placeholder={connection ? "Leave blank to keep current key" : "METRC User API Key"}
          className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1.5 text-xs bg-transparent"
        />
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
    </div>
  );
}
