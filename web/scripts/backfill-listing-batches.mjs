// One-time backfill for Listing.batchId ("menus" — see schema.prisma's
// comment) — every listing created before this field existed has
// batchId: null, which would otherwise render as N separate 1-item menus
// on the Account Executive's account page instead of the real menu they
// were actually uploaded as (a real report: a 34-strain bulk import
// showing as 34 individual menus instead of one).
//
// There's no exact record of which old listings were originally submitted
// together, so this infers batches from what IS on record: per seller,
// consecutive listings (sorted by createdAt) within GAP_MS of each other
// are treated as one batch — a real bulk-import loop creates its rows
// back-to-back within seconds; two genuinely separate uploads are normally
// much further apart than that. Idempotent — only ever touches rows where
// batchId is still null.
//
// Run: node scripts/backfill-listing-batches.mjs

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const GAP_MS = 2 * 60 * 1000; // 2 minutes

async function main() {
  const listings = await prisma.listing.findMany({
    where: { batchId: null },
    select: { id: true, postedById: true, createdAt: true },
    orderBy: [{ postedById: "asc" }, { createdAt: "asc" }],
  });

  const bySeller = new Map();
  for (const l of listings) {
    if (!bySeller.has(l.postedById)) bySeller.set(l.postedById, []);
    bySeller.get(l.postedById).push(l);
  }

  let batches = 0;
  let updated = 0;

  for (const [, rows] of bySeller) {
    let currentBatch = [];
    let lastTime = null;

    const flush = async () => {
      if (currentBatch.length === 0) return;
      const batchId = crypto.randomUUID();
      await prisma.listing.updateMany({
        where: { id: { in: currentBatch.map((r) => r.id) } },
        data: { batchId },
      });
      batches++;
      updated += currentBatch.length;
      currentBatch = [];
    };

    for (const row of rows) {
      if (lastTime !== null && row.createdAt.getTime() - lastTime > GAP_MS) {
        await flush();
      }
      currentBatch.push(row);
      lastTime = row.createdAt.getTime();
    }
    await flush();
  }

  console.log(`Inferred ${batches} menu(s) covering ${updated} previously-unbatched listing(s).`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
