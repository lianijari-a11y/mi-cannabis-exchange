import "server-only";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notifications";
import type { Category, Terms } from "@/lib/constants";

export async function createProductRequest(params: {
  retailerId: string;
  category: Category | null;
  productName: string;
  quantity: number;
  unit: string;
  targetPrice: number | null;
  termsPreference: Terms | null;
  note?: string;
}) {
  return prisma.productRequest.create({
    data: {
      retailerId: params.retailerId,
      category: params.category,
      productName: params.productName,
      quantity: params.quantity,
      unit: params.unit,
      targetPrice: params.targetPrice,
      termsPreference: params.termsPreference,
      note: params.note ?? null,
    },
  });
}

export async function closeProductRequest(requestId: string, retailerId: string) {
  const request = await prisma.productRequest.findUnique({ where: { id: requestId } });
  if (!request || request.retailerId !== retailerId) {
    throw new Error("Not authorized for this request.");
  }
  await prisma.productRequest.update({ where: { id: requestId }, data: { status: "closed" } });
}

// ---------- Retailer-facing (own requests, real identity is implicit —
// it's their own; responses show the supplier only via anonHandle) ----------

export async function productRequestsForRetailer(retailerId: string) {
  return prisma.productRequest.findMany({
    where: { retailerId },
    include: {
      responses: {
        include: {
          supplier: { select: { anonHandle: true } },
          listing: { select: { id: true, strainName: true, status: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

// ---------- Supplier-facing (grower/processor/broker) — the board of open
// requests, retailer shown only via anonHandle ----------

export async function openProductRequestsForSuppliers() {
  return prisma.productRequest.findMany({
    where: { status: "open" },
    include: { retailer: { select: { anonHandle: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function respondToProductRequest(params: {
  requestId: string;
  supplierId: string;
  listingId?: string;
  price?: number;
  quantity?: number;
  message: string;
}) {
  const request = await prisma.productRequest.findUnique({ where: { id: params.requestId } });
  if (!request || request.status !== "open") {
    throw new Error("This request is no longer open.");
  }

  if (params.listingId) {
    const listing = await prisma.listing.findUnique({ where: { id: params.listingId } });
    if (!listing || listing.postedById !== params.supplierId) {
      throw new Error("You can only link one of your own listings.");
    }
  }

  const response = await prisma.productRequestResponse.create({
    data: {
      requestId: params.requestId,
      supplierId: params.supplierId,
      listingId: params.listingId ?? null,
      price: params.price ?? null,
      quantity: params.quantity ?? null,
      message: params.message,
    },
  });

  await notify(
    request.retailerId,
    "product_request_response",
    `A supplier responded to your request for ${request.productName}.`,
    undefined
  );

  return response;
}

// A supplier's own sent responses — retailer identity stays anonymized on
// this side too, same boundary as everywhere else.
export async function productRequestResponsesForSupplier(supplierId: string) {
  return prisma.productRequestResponse.findMany({
    where: { supplierId },
    include: {
      request: { include: { retailer: { select: { anonHandle: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });
}

// ---------- Broker-facing (real identity, platform-wide) — see CLAUDE.md
// decision #2 ----------

export async function allProductRequestsForBroker() {
  return prisma.productRequest.findMany({
    include: {
      retailer: true,
      responses: { include: { supplier: true, listing: { select: { id: true, strainName: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });
}
