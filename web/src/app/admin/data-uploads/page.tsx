import { requireRole } from "@/lib/dal";
import { PortalShell } from "@/components/portal-shell";
import { allMonthlyReports } from "@/lib/monthly-report";
import { licenseRegistryStats } from "@/lib/license-registry-import";
import {
  uploadMonthlyReport,
  removeMonthlyReport,
  uploadLicenseRegistryCsv,
} from "./actions";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/listings", label: "All listings" },
  { href: "/admin/listings/new", label: "Post for a seller" },
  { href: "/admin/staff/new", label: "Add staff account" },
  { href: "/admin/sales-reps", label: "Sales rep earnings" },
  { href: "/admin/data-uploads", label: "Data uploads" },
  { href: "/admin/metrc", label: "METRC" },
  { href: "/admin/marketing", label: "Marketing suite" },
];

export default async function AdminDataUploadsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; imported?: string; skipped?: string }>;
}) {
  await requireRole("admin");
  const { error, imported, skipped } = await searchParams;
  const [reports, registryStats] = await Promise.all([allMonthlyReports(), licenseRegistryStats()]);

  return (
    <PortalShell roleLabel="Admin" navItems={NAV}>
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">Data uploads</h1>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
        Monthly refreshes from the state — re-uploading the same month replaces it rather than
        duplicating.
      </p>

      {error && (
        <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 rounded-lg p-2 mb-4">
          {error}
        </p>
      )}
      {imported && (
        <p className="text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900 rounded-lg p-2 mb-4">
          Imported {imported} license record{imported === "1" ? "" : "s"}
          {Number(skipped) > 0 ? ` (${skipped} skipped — unrecognized license category)` : ""}.
        </p>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
            CRA Monthly Report (.docx)
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            {reports.length} month{reports.length === 1 ? "" : "s"} on file
            {reports[0] ? ` — latest: ${reports[0].reportLabel}` : ""}.
          </p>
          <form action={uploadMonthlyReport} className="space-y-2 mb-4">
            <input
              type="file"
              name="report"
              accept=".docx"
              required
              className="text-xs file:mr-3 file:rounded-md file:border-0 file:bg-green-700 file:text-white file:px-3 file:py-1.5 file:text-xs"
            />
            <button type="submit" className="bg-green-700 text-white rounded-lg px-3 py-1.5 text-xs font-medium">
              Upload report
            </button>
          </form>
          <div className="space-y-1">
            {reports.map((r) => (
              <div key={r.id} className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-300">
                <span>{r.reportLabel}</span>
                <form action={removeMonthlyReport}>
                  <input type="hidden" name="id" value={r.id} />
                  <button type="submit" className="text-red-500 underline">
                    Remove
                  </button>
                </form>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
            CRA License Registry (.csv)
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            {registryStats.total} license record{registryStats.total === 1 ? "" : "s"} on file
            {registryStats.lastImportedAt
              ? ` — last refreshed ${registryStats.lastImportedAt.toISOString().slice(0, 10)}`
              : ""}
            .
          </p>
          <form action={uploadLicenseRegistryCsv} className="space-y-2 mb-4">
            <input
              type="file"
              name="csv"
              accept=".csv"
              required
              className="text-xs file:mr-3 file:rounded-md file:border-0 file:bg-green-700 file:text-white file:px-3 file:py-1.5 file:text-xs"
            />
            <button type="submit" className="bg-green-700 text-white rounded-lg px-3 py-1.5 text-xs font-medium">
              Import CSV
            </button>
          </form>
          <p className="text-[11px] text-gray-400">
            Upload one file at a time — one of Class B Grower, Class C Grower, Processor,
            Retailer, or Secure Transporter, same format as the state's own export. Re-uploading
            updates matching license numbers in place.
          </p>
          <div className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
            {registryStats.byCategory.map((c) => (
              <span key={c.category} className="mr-3">
                {c.category}: {c._count}
              </span>
            ))}
          </div>
        </section>
      </div>
    </PortalShell>
  );
}
