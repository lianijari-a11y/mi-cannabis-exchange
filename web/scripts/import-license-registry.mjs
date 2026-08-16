// Imports the state of Michigan's CRA licensee exports into LicenseRegistry.
// Run: node scripts/parse-license-csvs.mjs && node scripts/import-license-registry.mjs
//
// Phone enrichment note: the platform owner's own Lead Directory has phone
// numbers for some of these businesses, but it uses a different
// license-number scheme than these state exports (confirmed by spot-checking
// — same company, different numbers), so a reliable merge needs a
// name-based join, not a license-number join. That join is NOT run here yet
// — it needs the Lead Directory as an actual file (CSV/JSON export) to
// process accurately rather than hand-transcribing hundreds of records from
// a chat paste, which risks attaching the wrong phone number to the wrong
// business. Follow-up: export the Lead Directory tab and re-run a merge pass
// that fills in LicenseRegistry.phone by matching normalized business names.

import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function parseExpiry(mmddyyyy) {
  if (!mmddyyyy) return null;
  const [m, d, y] = mmddyyyy.split("/").map(Number);
  if (!m || !d || !y) return null;
  return new Date(Date.UTC(y, m - 1, d));
}

async function main() {
  const raw = fs.readFileSync(
    path.join(process.cwd(), "scripts", "license-registry-merged.json"),
    "utf8"
  );
  const records = JSON.parse(raw);

  console.log(`Importing ${records.length} license records...`);

  let created = 0;
  let updated = 0;
  const batchSize = 4; // stay under Supabase pooler's 5-connection limit
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (r) => {
        const data = {
          category: r.category,
          recordType: r.recordType,
          businessName: r.businessName,
          street: r.street,
          city: r.city,
          state: r.state,
          zip: r.zip,
          status: r.status,
          expirationDate: parseExpiry(r.expirationDate),
          hasDisciplinaryAction: r.hasDisciplinaryAction,
        };
        const result = await prisma.licenseRegistry.upsert({
          where: { licenseNumber: r.licenseNumber },
          create: { licenseNumber: r.licenseNumber, ...data },
          update: data,
        });
        if (result) {
          // upsert doesn't tell us create-vs-update directly; count via findFirst is
          // too slow at this scale, so just track total processed instead.
        }
      })
    );
    if (i % 200 === 0) console.log(`  ${Math.min(i + batchSize, records.length)}/${records.length}`);
  }

  const total = await prisma.licenseRegistry.count();
  const byCategory = await prisma.licenseRegistry.groupBy({
    by: ["category"],
    _count: true,
  });
  console.log(`Done. LicenseRegistry now has ${total} rows.`);
  console.log(byCategory);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
