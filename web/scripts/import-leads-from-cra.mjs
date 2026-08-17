// Auto-populates the "MI Processors" and "MI Dispensaries" Lead CRM lists
// directly from the state of Michigan's own CRA license exports — the same
// 5 RecordList*.csv files used by lib/license-registry-import.ts (§12/§18),
// specifically the Processor and Retailer categories (a MI "Retailer"
// license is what this CRM calls a "Dispensary"). Per the human's
// instruction: skip the Taino list entirely, and populate these two lists
// this way instead of via the source CRM tool's own CSV export — there is
// no contact/phone/email in the state data, so every imported record lands
// as disposition "NO_PHONE", same convention already used throughout the
// Lead Directory (MI) import for growers with no phone on file.
//
// Run: node scripts/import-leads-from-cra.mjs <processor-csv> <retailer-csv>

import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Same hand-rolled quoted-CSV parser used elsewhere in scripts/.
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

function toLeadRecords(csvPath, listKey) {
  const text = fs.readFileSync(path.resolve(csvPath), "utf8");
  const rows = parseCsv(text);
  const [, ...body] = rows;
  return body
    .filter((r) => r[0] && r[0].trim())
    .map((r) => {
      const [recordNumber, recordType, licenseName, address, expirationDate, status, notesCol, disciplinaryAction] = r;
      const addr = parseAddress(address);
      const noteBits = [];
      if (notesCol && notesCol.trim()) noteBits.push(notesCol.trim());
      if (disciplinaryAction && disciplinaryAction.trim()) noteBits.push("Has public disciplinary record on file with LARA");
      return {
        listKey,
        primaryStatus: "NA",
        company: licenseName?.trim() || "(unnamed licensee)",
        contact: null,
        phone: null,
        altPhone: null,
        email: null,
        website: null,
        address: addr.street,
        city: addr.city,
        state: addr.state,
        zip: addr.zip,
        license: recordNumber?.trim() || null,
        licenseType: recordType?.trim() || null,
        licenseStatus: status?.trim() || null,
        serviceZone: status?.trim() === "Active" && expirationDate?.trim() ? `Next expiry: ${expirationDate.trim()}` : null,
        notes: noteBits.join(" | ") || null,
        assignedRepName: null,
        disposition: "NO_PHONE",
        saleAmount: null,
        callbackDate: null,
        calledCount: 0,
        lastCallAt: null,
      };
    });
}

async function importList(records, label) {
  console.log(`${label}: importing ${records.length} records...`);
  let created = 0;
  const batchSize = 4; // stay under Supabase pooler's 5-connection limit
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    await Promise.all(batch.map((rec) => prisma.lead.create({ data: rec }).then(() => created++)));
  }
  console.log(`${label}: created ${created} leads.`);
  return created;
}

async function main() {
  const [processorCsv, retailerCsv] = process.argv.slice(2);
  if (!processorCsv || !retailerCsv) {
    console.error("Usage: node scripts/import-leads-from-cra.mjs <processor-csv> <retailer-csv>");
    process.exit(1);
  }

  const processorRecords = toLeadRecords(processorCsv, "mi_processors");
  const dispensaryRecords = toLeadRecords(retailerCsv, "mi_dispensaries");

  await importList(processorRecords, "MI Processors");
  await importList(dispensaryRecords, "MI Dispensaries");

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
