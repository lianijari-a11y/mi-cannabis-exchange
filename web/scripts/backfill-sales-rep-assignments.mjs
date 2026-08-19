// One-time backfill for CLAUDE.md §38's exclusive AE assignment — the
// claiming logic (claimOrVerifySellerAssignment) only fires on new writes
// going forward, so any grower/processor with listings already created by
// an Account Executive BEFORE that feature shipped has no
// User.assignedSalesRepId set, and so doesn't show up grouped under any
// rep's "My accounts" view even though a rep has clearly been working with
// them. Assigns each such seller to whichever rep created their EARLIEST
// listing (closest available proxy for "who actually made first contact").
// Idempotent — only ever touches sellers where assignedSalesRepId is still
// null, safe to re-run.
//
// Run: node scripts/backfill-sales-rep-assignments.mjs

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const unassigned = await prisma.user.findMany({
    where: {
      role: { in: ["grower", "processor"] },
      assignedSalesRepId: null,
      listings: { some: { createdBySalesRepId: { not: null } } },
    },
    select: {
      id: true,
      businessName: true,
      listings: {
        where: { createdBySalesRepId: { not: null } },
        select: { createdBySalesRepId: true, createdAt: true },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
  });

  console.log(`${unassigned.length} seller(s) need backfilling.`);
  for (const seller of unassigned) {
    const repId = seller.listings[0]?.createdBySalesRepId;
    if (!repId) continue;
    // Only claim if the rep who created it is actually a sales_rep (not
    // Admin, whose id can also land in createdBySalesRepId per CLAUDE.md
    // §13 — Admin was always exempt from this lock and shouldn't get
    // silently opted into "owning" an account through a backfill).
    const rep = await prisma.user.findUnique({ where: { id: repId }, select: { role: true } });
    if (rep?.role !== "sales_rep") {
      console.log(`  skip ${seller.businessName} — creator is ${rep?.role ?? "unknown"}, not a Sales Rep`);
      continue;
    }
    await prisma.user.update({ where: { id: seller.id }, data: { assignedSalesRepId: repId } });
    console.log(`  assigned ${seller.businessName} -> rep ${repId}`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
