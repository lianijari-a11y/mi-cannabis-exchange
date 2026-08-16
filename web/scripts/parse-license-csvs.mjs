import fs from "fs";
import path from "path";

// Minimal CSV parser that handles quoted fields with embedded commas.
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

const FILES = [
  { path: "/Users/alex/Downloads/RecordList20260816.csv", category: "grower_c" },
  { path: "/Users/alex/Downloads/RecordList20260816-2.csv", category: "grower_b" },
  { path: "/Users/alex/Downloads/RecordList20260816-3.csv", category: "processor" },
  { path: "/Users/alex/Downloads/RecordList20260816-4.csv", category: "retailer" },
  { path: "/Users/alex/Downloads/RecordList20260816-5.csv", category: "transporter" },
];

function parseAddress(raw) {
  // "1330 Imlay City RD Suite F, Lapeer MI 48446" -> street/city/state/zip
  if (!raw) return { street: null, city: null, state: null, zip: null };
  const parts = raw.split(",").map(s => s.trim());
  const cityStateZip = parts[parts.length - 1] || "";
  const street = parts.slice(0, -1).join(", ") || null;
  const m = cityStateZip.match(/^(.*)\s+([A-Z]{2})\s+(\d{5}(-\d{4})?)$/);
  if (m) return { street, city: m[1].trim(), state: m[2], zip: m[3] };
  return { street, city: cityStateZip || null, state: "MI", zip: null };
}

const all = [];
for (const f of FILES) {
  const text = fs.readFileSync(f.path, "utf8");
  const rows = parseCsv(text);
  const [header, ...body] = rows;
  for (const r of body) {
    if (!r[0]) continue;
    const [recordNumber, recordType, licenseName, address, expirationDate, status, notes, disciplinaryAction] = r;
    const addr = parseAddress(address);
    all.push({
      licenseNumber: recordNumber.trim(),
      category: f.category,
      recordType: recordType?.trim() || null,
      businessName: licenseName?.trim() || null,
      street: addr.street,
      city: addr.city,
      state: addr.state,
      zip: addr.zip,
      expirationDate: expirationDate?.trim() || null,
      status: status?.trim() || null,
      hasDisciplinaryAction: !!(disciplinaryAction && disciplinaryAction.trim()),
    });
  }
}

console.log(`Parsed ${all.length} total records across ${FILES.length} files`);
const byCategory = {};
for (const r of all) byCategory[r.category] = (byCategory[r.category] || 0) + 1;
console.log(byCategory);
const byStatus = {};
for (const r of all) byStatus[r.status] = (byStatus[r.status] || 0) + 1;
console.log(byStatus);

fs.writeFileSync(
  path.join(process.cwd(), "scripts", "license-registry-merged.json"),
  JSON.stringify(all, null, 0)
);
console.log("Wrote scripts/license-registry-merged.json");
