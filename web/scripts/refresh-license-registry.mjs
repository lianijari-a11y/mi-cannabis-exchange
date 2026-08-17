// Monthly license registry refresh — same logic as
// src/lib/license-registry-import.ts's importLicenseRegistryCsv (the
// Admin-upload version, CLAUDE.md §18), duplicated here as a standalone
// script because tsx can't resolve "server-only" imports outside the
// Next.js build. Upserts by licenseNumber, auto-detecting category per row
// from the state's own "Record Type" text, so any of the 5 files can be
// passed in any order without a manual file->category mapping.
//
// Run: node scripts/refresh-license-registry.mjs <csv1> <csv2> ...

import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function parseCsv(text) {
  const rows = [];
  let row = [];
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

function parseAddress(raw) {
  if (!raw) return { street: null, city: null, state: null, zip: null };
  const parts = raw.split(",").map((s) => s.trim());
  const cityStateZip = parts[parts.length - 1] || "";
  const street = parts.slice(0, -1).join(", ") || null;
  const m = cityStateZip.match(/^(.*)\s+([A-Z]{2})\s+(\d{5}(-\d{4})?)$/);
  if (m) return { street, city: m[1].trim(), state: m[2], zip: m[3] };
  return { street, city: cityStateZip || null, state: "MI", zip: null };
}

function categoryFromRecordType(recordType) {
  const t = (recordType || "").toLowerCase();
  if (t.includes("class b") && t.includes("grower")) return "grower_b";
  if (t.includes("class c") && t.includes("grower")) return "grower_c";
  if (t.includes("processor")) return "processor";
  if (t.includes("retailer")) return "retailer";
  if (t.includes("secure transporter") || t.includes("transporter")) return "transporter";
  return null;
}

function parseExpiry(mmddyyyy) {
  if (!mmddyyyy) return null;
  const [m, d, y] = mmddyyyy.split("/").map(Number);
  if (!m || !d || !y) return null;
  return new Date(Date.UTC(y, m - 1, d));
}

async function importFile(filePath) {
  const text = fs.readFileSync(path.resolve(filePath), "utf8");
  const rows = parseCsv(text);
  const [, ...body] = rows;
  const records = body.filter((r) => r[0]);

  let imported = 0;
  let skippedUnknownCategory = 0;
  const batchSize = 4; // stay under Supabase pooler's 5-connection limit
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (r) => {
        const [recordNumber, recordType, licenseName, address, expirationDate, status, , disciplinaryAction] = r;
        const category = categoryFromRecordType(recordType);
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
  console.log(`${path.basename(filePath)}: ${imported} imported, ${skippedUnknownCategory} skipped (unknown category)`);
  return { imported, skippedUnknownCategory };
}

async function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error("Usage: node scripts/refresh-license-registry.mjs <csv1> <csv2> ...");
    process.exit(1);
  }

  let totalImported = 0;
  let totalSkipped = 0;
  for (const f of files) {
    const { imported, skippedUnknownCategory } = await importFile(f);
    totalImported += imported;
    totalSkipped += skippedUnknownCategory;
  }

  const total = await prisma.licenseRegistry.count();
  const byCategory = await prisma.licenseRegistry.groupBy({ by: ["category"], _count: true });
  console.log(`\nDone. Imported/updated ${totalImported} rows this run (${totalSkipped} skipped).`);
  console.log(`LicenseRegistry now has ${total} rows total.`);
  console.log(byCategory);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
