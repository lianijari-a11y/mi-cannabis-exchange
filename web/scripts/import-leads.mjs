// One-time import of the "Lead Directory (MI)" list from the source CRM
// artifact's own CSV export (Business Lists tool → ⬇ Export on the
// "Lead Directory" tab). See CLAUDE.md §20 — this is the first of the 4
// source lists to be imported; Taino, MI Processors, and MI Dispensaries
// still need their own CSV exports before they can be imported the same way.
//
// Run: node scripts/import-leads.mjs /path/to/lead-overrides-v1-export.csv

import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Same hand-rolled quoted-CSV parser used by parse-license-csvs.mjs — handles
// quoted fields with embedded commas and embedded newlines.
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

function nullIfBlank(v) {
  return v && v.trim() !== "" ? v.trim() : null;
}

function parseDateOnly(v) {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v.trim())) return null;
  return new Date(v.trim() + "T00:00:00Z");
}

function parseTimestamp(v) {
  if (!v) return null;
  const m = v.trim().match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}(?::\d{2})?)$/);
  if (!m) return null;
  return new Date(`${m[1]}T${m[2].length === 5 ? m[2] + ":00" : m[2]}Z`);
}

function parseFloatOrNull(v) {
  if (!v) return null;
  const n = parseFloat(v.replace(/[^0-9.]/g, ""));
  return isNaN(n) ? null : n;
}

function parseIntOrZero(v) {
  const n = parseInt(v, 10);
  return isNaN(n) ? 0 : n;
}

// Splits the exported "activity_log" column back into {date, text} entries.
// Entries are joined with " | " on export, but a note's own text can also
// contain " | " (seen in real data), so we can't just split on that
// delimiter — instead we find every "date: " boundary and take everything
// up to the next one as that entry's text.
function parseActivityLog(v) {
  if (!v || !v.trim()) return [];
  const re = /(\d{4}-\d{2}-\d{2} \d{2}:\d{2}(?::\d{2})?): /g;
  const matches = [...v.matchAll(re)];
  if (matches.length === 0) return [];
  const entries = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : v.length;
    let text = v.slice(start, end).trim();
    text = text.replace(/\s\|\s*$/, "").trim();
    if (text) entries.push({ date: matches[i][1], text });
  }
  return entries;
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: node scripts/import-leads.mjs <path-to-csv>");
    process.exit(1);
  }
  const raw = fs.readFileSync(path.resolve(filePath), "utf8");
  const rows = parseCsv(raw);
  const header = rows[0].map((h) => h.trim());
  const idx = (name) => header.indexOf(name);

  const col = {
    company: idx("company"),
    contact: idx("contact"),
    status: idx("status"),
    disposition: idx("disposition"),
    sale_amount: idx("sale_amount"),
    callback_date: idx("callback_date"),
    phone: idx("phone"),
    alt_phone: idx("alt_phone"),
    email: idx("email"),
    website: idx("website"),
    address: idx("address"),
    city: idx("city"),
    state: idx("state"),
    zip: idx("zip"),
    license: idx("license"),
    license_type: idx("license_type"),
    service_zone: idx("service_zone"),
    notes: idx("notes"),
    activity_log: idx("activity_log"),
    called_count: idx("called_count"),
    last_call: idx("last_call"),
    assigned_rep: idx("assigned_rep"),
    license_status: idx("license_status"),
  };
  for (const [k, v] of Object.entries(col)) {
    if (v === -1) throw new Error(`Missing expected column: ${k}`);
  }

  const dataRows = rows.slice(1);
  console.log(`Parsed ${dataRows.length} data rows from ${filePath}`);

  const records = dataRows
    .filter((r) => nullIfBlank(r[col.company]))
    .map((r) => ({
      listKey: "leads",
      primaryStatus: nullIfBlank(r[col.status]) || "",
      company: r[col.company].trim(),
      contact: nullIfBlank(r[col.contact]),
      phone: nullIfBlank(r[col.phone]),
      altPhone: nullIfBlank(r[col.alt_phone]),
      email: nullIfBlank(r[col.email]),
      website: nullIfBlank(r[col.website]),
      address: nullIfBlank(r[col.address]),
      city: nullIfBlank(r[col.city]),
      state: nullIfBlank(r[col.state]),
      zip: nullIfBlank(r[col.zip]),
      license: nullIfBlank(r[col.license]),
      licenseType: nullIfBlank(r[col.license_type]),
      serviceZone: nullIfBlank(r[col.service_zone]),
      notes: nullIfBlank(r[col.notes]),
      assignedRepName: nullIfBlank(r[col.assigned_rep]),
      disposition: nullIfBlank(r[col.disposition]) || "NEW",
      saleAmount: parseFloatOrNull(r[col.sale_amount]),
      callbackDate: parseDateOnly(r[col.callback_date]),
      calledCount: parseIntOrZero(r[col.called_count]),
      lastCallAt: parseTimestamp(r[col.last_call]),
      licenseStatus: nullIfBlank(r[col.license_status]),
      activity: parseActivityLog(r[col.activity_log]),
    }));

  console.log(`${records.length} rows have a company name and will be imported.`);

  let created = 0;
  const batchSize = 4; // stay under Supabase pooler's 5-connection limit
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (rec) => {
        const { activity, ...leadData } = rec;
        await prisma.lead.create({
          data: {
            ...leadData,
            activity: activity.length
              ? { create: activity.map((a) => ({ text: `${a.date}: ${a.text}` })) }
              : undefined,
          },
        });
        created++;
      })
    );
    if ((i / batchSize) % 20 === 0) {
      console.log(`  ...${created}/${records.length}`);
    }
  }

  console.log(`Done. Created ${created} leads.`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
