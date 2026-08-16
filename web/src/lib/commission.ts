import "server-only";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notifications";

export type CommissionPayerType = "grower" | "retailer" | "split";

// Any broker can set or edit commission terms on any deal — same
// platform-wide visibility as everything else a broker sees (CLAUDE.md
// decision #2). See CLAUDE.md §10 for why this exists at all.
export async function setCommission(params: {
  dealId: string;
  brokerId: string;
  rate: number;
  payerType: CommissionPayerType;
  splitGrowerPct?: number;
}) {
  // Fully custom — the broker's own judgment call per deal, not capped to a
  // preset band. 100 is the only real ceiling (can't take more than the
  // deal is worth); see CLAUDE.md §10 for why this is broker discretion at
  // all.
  if (!Number.isFinite(params.rate) || params.rate < 0 || params.rate > 100) {
    throw new Error("Commission rate must be between 0 and 100%.");
  }
  if (params.payerType === "split") {
    if (
      params.splitGrowerPct === undefined ||
      !Number.isFinite(params.splitGrowerPct) ||
      params.splitGrowerPct < 0 ||
      params.splitGrowerPct > 100
    ) {
      throw new Error("Choose a valid grower/retailer split percentage.");
    }
  }

  const deal = await prisma.deal.findUnique({ where: { id: params.dealId } });
  if (!deal) throw new Error("Deal not found.");

  await prisma.commission.upsert({
    where: { dealId: params.dealId },
    create: {
      dealId: params.dealId,
      setByBrokerId: params.brokerId,
      rate: params.rate,
      payerType: params.payerType,
      splitGrowerPct: params.payerType === "split" ? params.splitGrowerPct : null,
    },
    update: {
      setByBrokerId: params.brokerId,
      rate: params.rate,
      payerType: params.payerType,
      splitGrowerPct: params.payerType === "split" ? params.splitGrowerPct : null,
      // Editing terms before the product is accepted is fine; once an
      // amount has already been computed (product accepted) we leave the
      // computed figures alone rather than silently recalculating a
      // number the parties may have already started paying against.
    },
  });
}

function computeCommissionAmounts(
  dealValue: number,
  rate: number,
  payerType: CommissionPayerType,
  splitGrowerPct: number | null
) {
  const amount = Math.round(dealValue * (rate / 100) * 100) / 100;
  let growerOwes = 0;
  let retailerOwes = 0;
  if (payerType === "grower") growerOwes = amount;
  else if (payerType === "retailer") retailerOwes = amount;
  else {
    const growerPct = splitGrowerPct ?? 50;
    growerOwes = Math.round(amount * (growerPct / 100) * 100) / 100;
    retailerOwes = Math.round((amount - growerOwes) * 100) / 100;
  }
  return { amount, growerOwes, retailerOwes };
}

// Retailer's explicit confirmation that the physically delivered product
// was received and is acceptable. This is the point commission (if any
// terms are set) becomes a computed, owed amount — not before.
export async function acceptProduct(dealId: string, retailerId: string) {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: { shipment: true, thread: { include: { listing: true } }, commission: true },
  });
  if (!deal || deal.retailerId !== retailerId) throw new Error("Not authorized for this deal.");
  if (deal.shipment?.status !== "delivered") {
    throw new Error("Product can only be accepted once it's marked delivered.");
  }
  if (deal.productStatus !== "pending") throw new Error("A decision has already been recorded.");

  const updates: Promise<unknown>[] = [
    prisma.deal.update({
      where: { id: dealId },
      data: { productStatus: "accepted", productDecisionAt: new Date() },
    }),
  ];

  if (deal.commission) {
    const dealValue = deal.finalPrice * deal.finalQuantity;
    const { amount, growerOwes, retailerOwes } = computeCommissionAmounts(
      dealValue,
      deal.commission.rate,
      deal.commission.payerType as CommissionPayerType,
      deal.commission.splitGrowerPct
    );
    updates.push(
      prisma.commission.update({
        where: { dealId },
        data: { amount, growerOwes, retailerOwes },
      })
    );
  }

  await Promise.all(updates);

  await notify(
    deal.sellerId,
    "product_accepted",
    `The retailer accepted delivery of ${deal.thread.listing.strainName} — this deal is now final.`,
    undefined
  );
  await notify(
    deal.commission?.setByBrokerId ?? deal.sellerId,
    "product_accepted",
    `Delivery accepted on ${deal.thread.listing.strainName}${
      deal.commission ? ` — commission of $${deal.commission.rate}% now owed.` : "."
    }`,
    undefined
  );
}

// Recorded, not processed — this app does not run a refund/return/dispute
// workflow. Real-world resolution happens off-platform, Broker-mediated,
// same caveat as CLAUDE.md §2.
export async function rejectProduct(dealId: string, retailerId: string, reason: string | null) {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: { shipment: true, thread: { include: { listing: true } } },
  });
  if (!deal || deal.retailerId !== retailerId) throw new Error("Not authorized for this deal.");
  if (deal.shipment?.status !== "delivered") {
    throw new Error("Product can only be rejected once it's marked delivered.");
  }
  if (deal.productStatus !== "pending") throw new Error("A decision has already been recorded.");

  await prisma.deal.update({
    where: { id: dealId },
    data: { productStatus: "rejected", productDecisionAt: new Date() },
  });

  await notify(
    deal.sellerId,
    "product_rejected",
    `The retailer rejected delivery of ${deal.thread.listing.strainName}${
      reason ? `: "${reason}"` : "."
    } This needs to be resolved off-platform.`,
    undefined
  );
}

export async function markCommissionPaid(dealId: string, actorId: string, actorRole: string) {
  const commission = await prisma.commission.findUnique({ where: { dealId } });
  if (!commission) throw new Error("No commission set on this deal.");
  if (actorRole !== "admin" && commission.setByBrokerId !== actorId) {
    throw new Error("Only the broker who set this commission, or an admin, can mark it paid.");
  }
  await prisma.commission.update({
    where: { dealId },
    data: { status: "paid", paidAt: new Date() },
  });
}
