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

  const dealValue = deal.finalPrice * deal.finalQuantity;

  const updates: Promise<unknown>[] = [
    prisma.deal.update({
      where: { id: dealId },
      data: { productStatus: "accepted", productDecisionAt: new Date() },
    }),
  ];

  if (deal.commission) {
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

  // Sales Rep commission — see CLAUDE.md §18 and the SalesRepCommission
  // model comment. Standing rate on the rep's own account, applied
  // automatically, snapshotted once here (a later rate change never
  // retroactively touches an already-computed commission).
  let salesRepCommissionAmount: number | null = null;
  if (deal.thread.listing.createdBySalesRepId) {
    const rep = await prisma.user.findUnique({
      where: { id: deal.thread.listing.createdBySalesRepId },
      select: { id: true, salesRepCommissionRate: true },
    });
    if (rep && rep.salesRepCommissionRate) {
      salesRepCommissionAmount = Math.round(dealValue * (rep.salesRepCommissionRate / 100) * 100) / 100;
      updates.push(
        prisma.salesRepCommission.create({
          data: { dealId, salesRepId: rep.id, rate: rep.salesRepCommissionRate, amount: salesRepCommissionAmount },
        })
      );
    }
  }

  await Promise.all(updates);

  await notify(
    deal.sellerId,
    "product_accepted",
    `The retailer accepted delivery of ${deal.thread.listing.strainName} — this deal is now final.`,
    undefined
  );
  // Real bug found in an audit, fixed here: this used to fall back to
  // deal.sellerId when no commission existed, sending the seller a second,
  // nearly-identical "product_accepted" notification for no reason — the
  // fallback was meant to cover "no broker to tell," not "tell the seller
  // twice." Only fires when a broker actually set commission on this deal.
  if (deal.commission) {
    await notify(
      deal.commission.setByBrokerId,
      "product_accepted",
      `Delivery accepted on ${deal.thread.listing.strainName} — commission of ${deal.commission.rate}% now owed.`,
      undefined
    );
  }
  // The Account Executive whose listing this deal came from is owed a
  // SalesRepCommission the moment it was just computed above (if their
  // standing rate was set) — previously never told at all.
  if (deal.thread.listing.createdBySalesRepId && salesRepCommissionAmount !== null) {
    await notify(
      deal.thread.listing.createdBySalesRepId,
      "sales_rep_commission_earned",
      `Delivery accepted on ${deal.thread.listing.strainName} — $${salesRepCommissionAmount} commission earned.`,
      undefined
    );
  }
}

// Added 2026-08-16 — rejecting now opens a resolution flow instead of just
// being recorded: the retailer states why, then separately picks return-vs-
// counter-offer (see chooseReturn / proposeRejectionCounter below). This
// still is NOT a refund/payment/return-shipping engine — money and physical
// logistics for the return stay off-platform, same caveat as CLAUDE.md §2 —
// but the negotiation over how to resolve it is now tracked in-app instead
// of just being a dead-end notification.
export async function rejectProduct(dealId: string, retailerId: string, reason: string) {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: { shipment: true, thread: { include: { listing: true } } },
  });
  if (!deal || deal.retailerId !== retailerId) throw new Error("Not authorized for this deal.");
  if (deal.shipment?.status !== "delivered") {
    throw new Error("Product can only be rejected once it's marked delivered.");
  }
  if (deal.productStatus !== "pending") throw new Error("A decision has already been recorded.");
  if (!reason.trim()) throw new Error("A reason is required to reject delivery.");

  // The rejection fee rate/payer were locked in during the original
  // negotiation (CLAUDE.md §14) — computed here, at rejection, since that's
  // the event that actually triggers it. A rate of 0 (never negotiated)
  // means no fee, same as Commission's "no terms set" case.
  let feeAmount: number | null = null;
  let feeGrowerOwes: number | null = null;
  let feeRetailerOwes: number | null = null;
  if (deal.rejectionFeeRate > 0) {
    const dealValue = deal.finalPrice * deal.finalQuantity;
    feeAmount = Math.round(dealValue * (deal.rejectionFeeRate / 100) * 100) / 100;
    if (deal.rejectionFeePayer === "grower") {
      feeGrowerOwes = feeAmount;
      feeRetailerOwes = 0;
    } else if (deal.rejectionFeePayer === "retailer") {
      feeGrowerOwes = 0;
      feeRetailerOwes = feeAmount;
    } else {
      feeGrowerOwes = Math.round((feeAmount / 2) * 100) / 100;
      feeRetailerOwes = Math.round((feeAmount - feeGrowerOwes) * 100) / 100;
    }
  }

  await prisma.$transaction([
    prisma.deal.update({
      where: { id: dealId },
      data: { productStatus: "rejected", productDecisionAt: new Date() },
    }),
    prisma.productRejection.create({
      data: { dealId, reason: reason.trim(), feeAmount, feeGrowerOwes, feeRetailerOwes },
    }),
  ]);

  await notify(
    deal.sellerId,
    "product_rejected",
    `The retailer rejected delivery of ${deal.thread.listing.strainName}: "${reason.trim()}" — they'll either send it back or propose a revised price based on its condition.`,
    undefined
  );
}

// Retailer's choice #1: send the product back outright, no counter-offer.
// Terminal — physical return logistics happen off-platform.
export async function chooseReturn(dealId: string, retailerId: string) {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: { thread: { include: { listing: true } }, rejection: true },
  });
  if (!deal || deal.retailerId !== retailerId) throw new Error("Not authorized for this deal.");
  if (!deal.rejection || deal.rejection.status !== "pending") {
    throw new Error("No pending rejection to resolve on this deal.");
  }

  await prisma.productRejection.update({
    where: { dealId },
    data: { resolutionType: "return", status: "return_requested", resolvedAt: new Date() },
  });

  await notify(
    deal.sellerId,
    "product_rejection_return",
    `The retailer is sending ${deal.thread.listing.strainName} back — coordinate the physical return directly.`,
    undefined
  );
}

// Retailer's choice #2: propose a revised price reflecting the delivered
// product's condition, instead of an outright return. Single round — the
// grower accepts (closes the deal at the new price) or insists on the
// return; no back-and-forth counter loop, same scope cut as SplitContract.
export async function proposeRejectionCounter(
  dealId: string,
  retailerId: string,
  counterPrice: number,
  counterNote: string | null
) {
  if (!Number.isFinite(counterPrice) || counterPrice <= 0) {
    throw new Error("Enter a valid revised price.");
  }
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: { thread: { include: { listing: true } }, rejection: true },
  });
  if (!deal || deal.retailerId !== retailerId) throw new Error("Not authorized for this deal.");
  if (!deal.rejection || deal.rejection.status !== "pending") {
    throw new Error("No pending rejection to resolve on this deal.");
  }

  await prisma.productRejection.update({
    where: { dealId },
    data: { resolutionType: "counter_offer", counterPrice, counterNote: counterNote || null },
  });

  await notify(
    deal.sellerId,
    "product_rejection_counter",
    `The retailer proposed $${counterPrice}/${deal.thread.listing.unit} for the delivered ${deal.thread.listing.strainName} based on its condition${
      counterNote ? `: "${counterNote}"` : "."
    }`,
    undefined
  );
}

// Grower accepts the retailer's revised price — this closes the deal out at
// the new price (finalPrice is updated) rather than leaving the original
// rejected price on record.
export async function acceptRejectionCounter(dealId: string, sellerId: string) {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: { thread: { include: { listing: true } }, rejection: true },
  });
  if (!deal || deal.sellerId !== sellerId) throw new Error("Not authorized for this deal.");
  if (!deal.rejection || deal.rejection.resolutionType !== "counter_offer" || deal.rejection.status !== "pending") {
    throw new Error("No pending counter-offer to accept on this deal.");
  }
  if (deal.rejection.counterPrice === null) throw new Error("No counter price on file.");

  await prisma.$transaction([
    prisma.deal.update({
      where: { id: dealId },
      data: { finalPrice: deal.rejection.counterPrice, productStatus: "accepted", productDecisionAt: new Date() },
    }),
    prisma.productRejection.update({
      where: { dealId },
      data: { status: "counter_accepted", resolvedAt: new Date() },
    }),
  ]);

  await notify(
    deal.retailerId,
    "product_rejection_counter_accepted",
    `The grower accepted your revised price of $${deal.rejection.counterPrice}/${deal.thread.listing.unit} on ${deal.thread.listing.strainName} — this deal is now final.`,
    undefined
  );
}

// Grower rejects the counter-offer and insists on the return instead.
export async function requireReturnInsteadOfCounter(dealId: string, sellerId: string) {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: { thread: { include: { listing: true } }, rejection: true },
  });
  if (!deal || deal.sellerId !== sellerId) throw new Error("Not authorized for this deal.");
  if (!deal.rejection || deal.rejection.resolutionType !== "counter_offer" || deal.rejection.status !== "pending") {
    throw new Error("No pending counter-offer on this deal.");
  }

  await prisma.productRejection.update({
    where: { dealId },
    data: { status: "return_requested", resolvedAt: new Date() },
  });

  await notify(
    deal.retailerId,
    "product_rejection_return_required",
    `The grower declined your revised price on ${deal.thread.listing.strainName} and is requesting the product be returned — coordinate the physical return directly.`,
    undefined
  );
}

// Broker or admin marks a negotiated rejection fee as settled — same
// tracked-not-processed posture as markCommissionPaid below. Any broker can
// do this (platform-wide visibility, CLAUDE.md decision #2), not just one
// tied to this particular deal, since no broker "owns" a rejection fee the
// way one sets their own commission.
export async function markRejectionFeePaid(dealId: string, actorRole: string) {
  if (actorRole !== "admin" && actorRole !== "broker") {
    throw new Error("Only a broker or admin can mark a rejection fee paid.");
  }
  const rejection = await prisma.productRejection.findUnique({ where: { dealId } });
  if (!rejection || rejection.feeAmount === null) {
    throw new Error("No rejection fee on this deal.");
  }
  await prisma.productRejection.update({
    where: { dealId },
    data: { feeStatus: "paid", feePaidAt: new Date() },
  });
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
