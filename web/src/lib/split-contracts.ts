import "server-only";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notifications";

// Active raw-material listings posted by growers — what a Processor browses
// in Sourcing to propose a toll-processing split against. Same anonymization
// boundary as the retailer feed: only the poster's anonHandle is exposed.
export async function rawListingsForSourcing() {
  return prisma.listing.findMany({
    where: { status: "active", postedBy: { role: "grower" } },
    select: {
      id: true,
      strainName: true,
      category: true,
      thcPercent: true,
      quantity: true,
      unit: true,
      pricePerUnit: true,
      terms: true,
      media: true,
      postedBy: { select: { anonHandle: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function proposeSplitContract(params: {
  listingId: string;
  processorId: string;
  outputProduct: string;
  splitGrowerPct: number;
  note?: string;
}) {
  const listing = await prisma.listing.findUnique({ where: { id: params.listingId } });
  if (!listing || listing.status !== "active") {
    throw new Error("This listing is no longer active.");
  }

  const contract = await prisma.splitContract.create({
    data: {
      listingId: params.listingId,
      growerId: listing.postedById,
      processorId: params.processorId,
      outputProduct: params.outputProduct,
      splitGrowerPct: params.splitGrowerPct,
      note: params.note ?? null,
    },
  });

  await notify(
    listing.postedById,
    "split_proposed",
    `A processor proposed a ${params.splitGrowerPct}/${
      100 - params.splitGrowerPct
    } split on ${listing.strainName} for ${params.outputProduct}.`,
    undefined
  );

  return contract;
}

export async function respondToSplitContract(
  contractId: string,
  growerId: string,
  decision: "accepted" | "rejected"
) {
  const contract = await prisma.splitContract.findUnique({
    where: { id: contractId },
    include: { listing: true },
  });
  if (!contract) throw new Error("Contract not found.");
  if (contract.growerId !== growerId) throw new Error("Not authorized for this contract.");
  if (contract.status !== "proposed") throw new Error("This proposal is no longer pending.");

  if (decision === "accepted") {
    await prisma.$transaction([
      prisma.splitContract.update({ where: { id: contractId }, data: { status: "accepted" } }),
      prisma.listing.update({ where: { id: contract.listingId }, data: { status: "closed" } }),
    ]);
  } else {
    await prisma.splitContract.update({ where: { id: contractId }, data: { status: "rejected" } });
  }

  await notify(
    contract.processorId,
    decision === "accepted" ? "split_accepted" : "split_rejected",
    `The grower ${decision} your split-contract proposal on ${contract.listing.strainName}.`,
    undefined
  );

  return contract;
}

export async function startProcessing(contractId: string, processorId: string) {
  const contract = await prisma.splitContract.findUnique({ where: { id: contractId } });
  if (!contract || contract.processorId !== processorId) {
    throw new Error("Not authorized for this contract.");
  }
  if (contract.status !== "accepted") throw new Error("Contract isn't ready for processing.");
  await prisma.splitContract.update({ where: { id: contractId }, data: { status: "processing" } });
}

export async function logYield(
  contractId: string,
  processorId: string,
  yieldQty: number,
  yieldUnit: string
) {
  const contract = await prisma.splitContract.findUnique({ where: { id: contractId } });
  if (!contract || contract.processorId !== processorId) {
    throw new Error("Not authorized for this contract.");
  }
  if (contract.status !== "processing") throw new Error("Contract isn't in processing.");
  await prisma.splitContract.update({
    where: { id: contractId },
    data: { yieldQty, yieldUnit, status: "finished" },
  });
}

// Settlement never involves the platform taking a cut — it's purely the
// grower/processor split of an agreed value. Either side can key it in;
// there's no separate confirmation step in this v1 (same simplification as
// the single propose->accept/reject flow — no counter-negotiation loop).
export async function settleContract(
  contractId: string,
  actorId: string,
  settlementValue: number
) {
  const contract = await prisma.splitContract.findUnique({ where: { id: contractId } });
  if (!contract || (contract.growerId !== actorId && contract.processorId !== actorId)) {
    throw new Error("Not authorized for this contract.");
  }
  if (contract.status !== "finished") throw new Error("Contract isn't ready to settle.");

  const growerAmount = Math.round(settlementValue * (contract.splitGrowerPct / 100) * 100) / 100;
  const processorAmount = Math.round((settlementValue - growerAmount) * 100) / 100;

  await prisma.splitContract.update({
    where: { id: contractId },
    data: {
      status: "settled",
      settlementValue,
      settlementGrowerAmount: growerAmount,
      settlementProcessorAmount: processorAmount,
    },
  });

  const otherPartyId = actorId === contract.growerId ? contract.processorId : contract.growerId;
  await notify(
    otherPartyId,
    "split_settled",
    `This split contract settled at $${settlementValue} — grower gets $${growerAmount}, processor gets $${processorAmount}.`,
    undefined
  );
}

export async function splitContractsForGrower(growerId: string) {
  return prisma.splitContract.findMany({
    where: { growerId },
    include: {
      listing: { select: { id: true, strainName: true, category: true, unit: true } },
      processor: { select: { anonHandle: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function splitContractsForProcessor(processorId: string) {
  return prisma.splitContract.findMany({
    where: { processorId },
    include: {
      listing: { select: { id: true, strainName: true, category: true, unit: true } },
      grower: { select: { anonHandle: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
}

// Split-contract proposals on one listing, scoped to that listing's grower —
// same shape/anonymization pattern as offers.ts's threadsForListing.
export async function splitContractsForListing(listingId: string, growerId: string) {
  return prisma.splitContract.findMany({
    where: { listingId, growerId },
    include: { processor: { select: { anonHandle: true } } },
    orderBy: { createdAt: "desc" },
  });
}
