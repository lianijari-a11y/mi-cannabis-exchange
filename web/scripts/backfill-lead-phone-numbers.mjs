// One-time backfill for the new LeadPhoneNumber table (multiple named
// numbers per lead) — every existing lead only ever had the old flat
// `phone`/`altPhone` fields, so this creates a real LeadPhoneNumber row
// for each one that's non-empty: `phone` becomes sortOrder 0 (main),
// `altPhone` becomes sortOrder 1 (second choice). Idempotent — skips any
// lead that already has phoneNumbers rows, safe to re-run.
//
// Run: node scripts/backfill-lead-phone-numbers.mjs

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const leads = await prisma.lead.findMany({
    where: { OR: [{ phone: { not: null } }, { altPhone: { not: null } }] },
    select: { id: true, phone: true, altPhone: true, phoneNumbers: { select: { id: true } } },
  });
  console.log(`${leads.length} leads have a phone or altPhone on file.`);

  const toBackfill = leads.filter((l) => l.phoneNumbers.length === 0);
  console.log(`${toBackfill.length} of those have no LeadPhoneNumber rows yet — backfilling.`);

  let created = 0;
  const batchSize = 4;
  for (let i = 0; i < toBackfill.length; i += batchSize) {
    const batch = toBackfill.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (lead) => {
        const rows = [];
        if (lead.phone?.trim()) rows.push({ leadId: lead.id, phone: lead.phone.trim(), sortOrder: 0 });
        if (lead.altPhone?.trim()) rows.push({ leadId: lead.id, phone: lead.altPhone.trim(), sortOrder: 1 });
        if (rows.length === 0) return;
        await prisma.leadPhoneNumber.createMany({ data: rows });
        created += rows.length;
      })
    );
  }

  console.log(`Done. Created ${created} LeadPhoneNumber rows.`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
