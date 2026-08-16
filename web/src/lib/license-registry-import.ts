import "server-only";
import { prisma } from "@/lib/prisma";

// Minimal CSV parser handling quoted fields with embedded commas — same
// logic as scripts/parse-license-csvs.mjs (the one-time initial import),
// ported here so Admin can re-run this monthly from the UI instead of the
// CLI. See CLAUDE.md §18.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field); field = "";
        if (row.length > 1 || row[0] !== "") rows.push(row);
        row = [];
      } else field += c;
    }
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function parseAddress(raw: string | undefined) {
  if (!raw) return { street: null, city: null, state: null, zip: null };
  const parts = raw.split(",").map((s) => s.trim());
  const cityStateZip = parts[parts.length - 1] || "";
  const street = parts.slice(0, -1).join(", ") || null;
  const m = cityStateZip.match(/^(.*)\s+([A-Z]{2})\s+(\d{5}(-\d{4})?)$/);
  if (m) return { street, city: m[1].trim(), state: m[2], zip: m[3] };
  return { street, city: cityStateZip || null, state: "MI", zip: null };
}

// The state's own "Record Type" text tells us the category — the CRA's own
// export names differ slightly by category, so this auto-detects instead
// of requiring the admin to map each file to a category by hand (and
// prevents a wrong upload from silently overwriting the wrong bucket).
function categoryFromRecordType(recordType: string): string | null {
  const t = recordType.toLowerCase();
  if (t.includes("class b") && t.includes("grower")) return "grower_b";
  if (t.includes("class c") && t.includes("grower")) return "grower_c";
  if (t.includes("processor")) return "processor";
  if (t.includes("retailer")) return "retailer";
  if (t.includes("secure transporter") || t.includes("transporter")) return "transporter";
  return null;
}

function parseExpiry(mmddyyyy: string | undefined): Date | null {
  if (!mmddyyyy) return null;
  const [m, d, y] = mmddyyyy.split("/").map(Number);
  if (!m || !d || !y) return null;
  return new Date(Date.UTC(y, m - 1, d));
}

export type LicenseRegistryImportResult = {
  totalRows: number;
  imported: number;
  skippedUnknownCategory: number;
  fileName: string;
};

// Imports one CRA license-export CSV. Upserts by licenseNumber so
// re-uploading the same month's file (or a corrected one) updates status
// in place rather than duplicating rows — the monthly refresh this whole
// feature exists for.
export async function importLicenseRegistryCsv(
  fileBuffer: Buffer,
  fileName: string
): Promise<LicenseRegistryImportResult> {
  const text = fileBuffer.toString("utf8");
  const rows = parseCsv(text);
  const [, ...body] = rows; // drop header row

  let imported = 0;
  let skippedUnknownCategory = 0;
  const batchSize = 4; // stay under the Supabase pooler's connection limit

  const records = body.filter((r) => r[0]);
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (r) => {
        const [recordNumber, recordType, licenseName, address, expirationDate, status, , disciplinaryAction] = r;
        const category = categoryFromRecordType(recordType || "");
        if (!category) {
          skippedUnknownCategory++;
          return;
        }
        const addr = parseAddress(address);
        const data = {
          category,
          recordType: recordType?.trim() || null,
          businessName: licenseName?.trim() || "",
          street: addr.street,
          city: addr.city,
          state: addr.state,
          zip: addr.zip,
          status: status?.trim() || "",
          expirationDate: parseExpiry(expirationDate?.trim()),
          hasDisciplinaryAction: !!(disciplinaryAction && disciplinaryAction.trim()),
        };
        await prisma.licenseRegistry.upsert({
          where: { licenseNumber: recordNumber.trim() },
          create: { licenseNumber: recordNumber.trim(), ...data },
          update: data,
        });
        imported++;
      })
    );
  }

  return { totalRows: records.length, imported, skippedUnknownCategory, fileName };
}

export async function licenseRegistryStats() {
  const [total, byCategory, mostRecent] = await Promise.all([
    prisma.licenseRegistry.count(),
    prisma.licenseRegistry.groupBy({ by: ["category"], _count: true }),
    prisma.licenseRegistry.findFirst({ orderBy: { importedAt: "desc" }, select: { importedAt: true } }),
  ]);
  return { total, byCategory, lastImportedAt: mostRecent?.importedAt ?? null };
}
