// Recovery script, not a normal import path — the `leads` table was found
// completely empty (same underlying incident as §25/§35's LicenseRegistry
// wipe, just not yet noticed for this table). import-leads-from-cra.mjs
// needs the raw state CRA CSV files to rebuild "MI Processors"/"MI
// Dispensaries", and those files are no longer on disk anywhere in this
// environment — but the exact same data already lives in the LicenseRegistry
// table (restored earlier from scripts/license-registry-merged.json), so
// this derives the two CRA-sourced Lead lists straight from there instead
// of needing the CSVs again. Produces the same shape import-leads-from-cra.mjs
// did (disposition always "NO_PHONE" — LicenseRegistry's phone enrichment,
// §12, only ever covered grower_b/grower_c rows, never processor/retailer).
//
// Does NOT recover the "Lead Directory (MI)" list (530 real business
// contacts with phone numbers) — that data only ever existed in the
// platform owner's own CRM export CSV, which isn't derivable from anything
// else in this database. That list needs the human to re-supply the file.
//
// Run: node scripts/restore-leads-from-license-registry.mjs

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function toLead(row, listKey) {
  return {
    listKey,
    primaryStatus: "NA",
    company: row.businessName || "(unnamed licensee)",
    contact: null,
    phone: null,
    altPhone: null,
    email: null,
    website: null,
    address: row.street,
    city: row.city,
    state: row.state,
    zip: row.zip,
    license: row.licenseNumber,
    licenseType: row.recordType,
    licenseStatus: row.status,
    serviceZone:
      row.status === "Active" && row.expirationDate
        ? `Next expiry: ${row.expirationDate.toISOString().slice(0, 10)}`
        : null,
    notes: row.hasDisciplinaryAction ? "Has public disciplinary record on file with LARA" : null,
    assignedRepName: null,
    disposition: "NO_PHONE",
    saleAmount: null,
    callbackDate: null,
    calledCount: 0,
    lastCallAt: null,
  };
}

async function importList(category, listKey, label) {
  const rows = await prisma.licenseRegistry.findMany({ where: { category } });
  const records = rows.map((r) => toLead(r, listKey));
  console.log(`${label}: importing ${records.length} records from LicenseRegistry...`);
  let created = 0;
  const batchSize = 4; // stay under Supabase pooler's connection limit, same as other import scripts
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    await Promise.all(batch.map((rec) => prisma.lead.create({ data: rec }).then(() => created++)));
  }
  console.log(`${label}: created ${created} leads.`);
  return created;
}

async function main() {
  const existing = await prisma.lead.count();
  if (existing > 0) {
    console.error(`leads table already has ${existing} rows — refusing to run, this script is a one-time recovery for an empty table.`);
    process.exit(1);
  }
  await importList("processor", "mi_processors", "MI Processors");
  await importList("retailer", "mi_dispensaries", "MI Dispensaries");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
