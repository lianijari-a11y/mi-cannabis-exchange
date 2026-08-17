// Follow-up flagged in CLAUDE.md §12 and scripts/import-license-registry.mjs:
// fills LicenseRegistry.phone by matching business name against the
// platform owner's own "Lead Directory (MI)" CRM list — the two datasets
// use different license-number schemes (confirmed by spot-checking, same
// company/different numbers), so business name is the only reliable join
// key. Best-effort: this is a fuzzy name match on public-ish business
// names, not a guarantee — only fills rows that are currently phone:null,
// never overwrites.
//
// Run: node scripts/enrich-license-registry-phone.mjs <lead-directory-csv>

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

// Strips punctuation and common business-entity suffixes so "Forever Home
// Grown, LLC" and "FOREVER HOME GROWN LLC" (state export vs. CRM export
// formatting) normalize to the same join key.
function normalizeName(s) {
  return (s || "")
    .toUpperCase()
    .replace(/[.,'"]/g, "")
    .replace(/\b(LLC|INC|CORP|CORPORATION|CO|COMPANY|LTD|LP|LLP)\b\.?/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function digitsOnly(s) {
  return (s || "").replace(/\D/g, "");
}

function formatPhone(digits) {
  const d = digits.slice(-10);
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: node scripts/enrich-license-registry-phone.mjs <lead-directory-csv>");
    process.exit(1);
  }

  const raw = fs.readFileSync(path.resolve(filePath), "utf8");
  const rows = parseCsv(raw);
  const header = rows[0].map((h) => h.trim());
  const companyIdx = header.indexOf("company");
  const phoneIdx = header.indexOf("phone");
  const calledCountIdx = header.indexOf("called_count");
  if (companyIdx === -1 || phoneIdx === -1) throw new Error("Missing expected columns in CSV.");

  // Build normalized-name -> phone map from the CSV. On a collision (two
  // leads normalizing to the same name), prefer whichever has been called
  // more — a weak but reasonable signal that it's the more "real" record.
  const nameToPhone = new Map();
  const nameToCalls = new Map();
  for (const r of rows.slice(1)) {
    const company = r[companyIdx]?.trim();
    const phoneDigits = digitsOnly(r[phoneIdx]);
    if (!company || phoneDigits.length < 10) continue;
    const key = normalizeName(company);
    if (!key) continue;
    const calls = parseInt(r[calledCountIdx], 10) || 0;
    const existingCalls = nameToCalls.get(key) ?? -1;
    if (calls >= existingCalls) {
      nameToPhone.set(key, formatPhone(phoneDigits));
      nameToCalls.set(key, calls);
    }
  }
  console.log(`Built ${nameToPhone.size} unique normalized-name -> phone entries from ${filePath}.`);

  // Only growers are in scope — the Lead Directory list is specifically the
  // platform owner's grower-solicitation list (CLAUDE.md §12), and matching
  // it against processor/retailer/transporter registry rows would risk
  // false-positive name collisions across unrelated business types.
  const candidates = await prisma.licenseRegistry.findMany({
    where: { phone: null, category: { in: ["grower_b", "grower_c"] } },
    select: { id: true, businessName: true },
  });
  console.log(`${candidates.length} grower LicenseRegistry rows currently have no phone on file.`);

  const matches = candidates
    .map((c) => ({ id: c.id, phone: nameToPhone.get(normalizeName(c.businessName)) }))
    .filter((m) => m.phone);
  console.log(`${matches.length} matched by normalized business name.`);

  let updated = 0;
  const batchSize = 4; // stay under Supabase pooler's 5-connection limit
  for (let i = 0; i < matches.length; i += batchSize) {
    const batch = matches.slice(i, i + batchSize);
    await Promise.all(
      batch.map((m) => prisma.licenseRegistry.update({ where: { id: m.id }, data: { phone: m.phone } }).then(() => updated++))
    );
  }

  console.log(`Done. Updated ${updated} LicenseRegistry rows with a phone number.`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
