// Corrects Lead.license on the "leads" list (Lead Directory MI, 530 rows —
// the platform owner's own CRM export) to use the real Michigan CRA state
// license number from LicenseRegistry, instead of the CRM tool's own
// incompatible internal numbering scheme (confirmed by spot-check: "123
// Grow LLC" is GR-C-001968 in the CRM export vs. AU-G-C-001405..001409 in
// the real state registry — same business, unrelated numbers).
//
// Deliberately narrow: touches ONLY Lead.license on a confidently-matched
// row. Every other field (company, contact, phone, email, address, notes,
// disposition, saleAmount, callbackDate, calledCount, activity log,
// createdAt) is left completely untouched — this is a targeted per-row
// field update, never a row replacement or re-import.
//
// Scoped to grower_b/grower_c LicenseRegistry categories only, same
// false-positive-avoidance reasoning already established in
// scripts/enrich-license-registry-phone.mjs — the Lead Directory (MI) list
// is specifically the platform owner's grower-solicitation list, so
// matching against processor/retailer/transporter registry rows would
// risk crossing unrelated business types on a name collision.
//
// Only ever applies a HIGH-CONFIDENCE match (exact match after
// normalizing punctuation/entity suffixes). Anything ambiguous or
// unmatched is left exactly as-is, never blanked out.
//
// Run modes:
//   node scripts/correct-lead-directory-license-numbers.mjs          (dry run — reports only, writes nothing)
//   node scripts/correct-lead-directory-license-numbers.mjs --apply  (writes the corrected license numbers)

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

function normalizeName(s) {
  return (s || "")
    .toUpperCase()
    .replace(/[.,'"]/g, "")
    .replace(/\b(LLC|INC|CORP|CORPORATION|CO|COMPANY|LTD|LP|LLP)\b\.?/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  const leads = await prisma.lead.findMany({
    where: { listKey: "leads" },
    select: { id: true, company: true, license: true },
  });
  console.log(`${leads.length} rows in the Lead Directory (MI) list.`);

  const registryRows = await prisma.licenseRegistry.findMany({
    where: { category: { in: ["grower_b", "grower_c"] } },
    select: { businessName: true, licenseNumber: true },
  });
  console.log(`${registryRows.length} grower rows in the real CRA LicenseRegistry to match against.`);

  // Group real registry rows by normalized name — a business can hold
  // multiple licenses (e.g. "123 Grow LLC" holds 5), so this is a
  // name -> [licenseNumber, ...] map, not a 1:1 map.
  const nameToLicenses = new Map();
  for (const r of registryRows) {
    const key = normalizeName(r.businessName);
    if (!key) continue;
    if (!nameToLicenses.has(key)) nameToLicenses.set(key, []);
    nameToLicenses.get(key).push(r.licenseNumber);
  }

  const changes = [];
  let noMatch = 0;
  let alreadyCorrect = 0;
  for (const lead of leads) {
    const key = normalizeName(lead.company);
    const realLicenses = nameToLicenses.get(key);
    if (!realLicenses || realLicenses.length === 0) {
      noMatch++;
      continue;
    }
    realLicenses.sort();
    const newValue = realLicenses.length === 1 ? realLicenses[0] : `${realLicenses[0]} (+${realLicenses.length - 1} more)`;
    if (newValue === lead.license) {
      alreadyCorrect++;
      continue;
    }
    changes.push({ id: lead.id, company: lead.company, oldLicense: lead.license, newLicense: newValue });
  }

  console.log(`\n${changes.length} rows would be corrected.`);
  console.log(`${alreadyCorrect} rows already match the real registry number (no change needed).`);
  console.log(`${noMatch} rows have no confident match in the real registry (left untouched).`);

  console.log(`\nSample of changes (first 15):`);
  for (const c of changes.slice(0, 15)) {
    console.log(`  ${c.company}: "${c.oldLicense ?? "(none)"}" -> "${c.newLicense}"`);
  }

  if (!APPLY) {
    console.log(`\nDry run only — nothing was written. Re-run with --apply to make these changes.`);
    await prisma.$disconnect();
    return;
  }

  console.log(`\nApplying ${changes.length} updates (license field only, batched to stay under the connection-pool limit)...`);
  let updated = 0;
  const batchSize = 4;
  for (let i = 0; i < changes.length; i += batchSize) {
    const batch = changes.slice(i, i + batchSize);
    await Promise.all(
      batch.map((c) =>
        prisma.lead.update({ where: { id: c.id }, data: { license: c.newLicense } }).then(() => updated++)
      )
    );
  }
  console.log(`Done. Updated ${updated} Lead rows' license field. No other field was touched.`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
