import "server-only";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notifications";

// Public order-ahead storefront (CLAUDE.md §25). Unlike every other lib/*
// module in this app, functions here are called with NO session at all —
// this is the one surface an anonymous member of the public reaches.
// requireRole is never used here on purpose; there is no role to require.
//
// Per-retailer only, never cross-retailer — there is no "browse every
// dispensary" marketplace view anywhere in this file. Each function takes
// a specific retailerId (resolved from a storefrontSlug) and never returns
// data about any other retailer.
//
// publicMenuForRetailer deliberately uses a narrow `select`, never `include`,
// and never joins InventoryLot -> Deal -> Listing -> ListingMedia — that
// join would risk re-exposing the real Grower/Processor identity behind
// Deal.sellerId (the exact field CLAUDE.md's audit log documents as a real,
// already-fixed RSC leak, §21 finding A) to an anonymous public visitor
// instead of just the logged-in retailer. InventoryLot has no photo field
// and this module doesn't add one — see CLAUDE.md §25.

export async function retailerByStorefrontSlug(slug: string) {
  return prisma.user.findFirst({
    where: { role: "retailer", storefrontSlug: slug },
    select: { id: true, businessName: true },
  });
}

export async function publicMenuForRetailer(retailerId: string) {
  return prisma.inventoryLot.findMany({
    where: { retailerId, status: "active", quantityRemaining: { gt: 0 } },
    select: {
      id: true,
      sku: true,
      productName: true,
      category: true,
      thcPercent: true,
      thcMgPerUnit: true,
      unit: true,
      retailPricePerUnit: true,
      quantityRemaining: true,
    },
    orderBy: { productName: "asc" },
  });
}

export async function orderStatus(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      customerName: true,
      requestedPickupNote: true,
      createdAt: true,
      retailer: { select: { businessName: true } },
      lineItems: {
        select: {
          quantity: true,
          unitPriceSnapshot: true,
          lineTotal: true,
          inventoryLot: { select: { productName: true, unit: true } },
        },
      },
    },
  });
}

export async function placeOrder(
  retailerId: string,
  customerName: string,
  customerPhone: string,
  ageAttested: boolean,
  lines: { lotId: string; quantity: number }[],
  requestedPickupNote?: string,
  marketingOptIn = false
) {
  if (!customerName.trim()) throw new Error("Enter your name.");
  if (!customerPhone.trim()) throw new Error("Enter a phone number.");
  if (!ageAttested) throw new Error("You must confirm you're 21 or older to order.");
  if (lines.length === 0) throw new Error("Your cart is empty.");

  const lots = await prisma.inventoryLot.findMany({
    where: { id: { in: lines.map((l) => l.lotId) }, retailerId, status: "active" },
  });
  const lotById = new Map(lots.map((l) => [l.id, l]));

  let total = 0;
  const lineData = lines.map((line) => {
    const lot = lotById.get(line.lotId);
    if (!lot) throw new Error("One of the items in your cart is no longer available.");
    if (line.quantity <= 0) throw new Error(`Enter a quantity for ${lot.productName}.`);
    // Soft check only — this is informational for the customer, not a hard
    // reservation. Inventory isn't decremented until the retailer actually
    // fulfills the order (lib/pos.ts's fulfillOrder), so real stock could
    // still move between now and then; fulfillOrder re-validates for real.
    if (line.quantity > lot.quantityRemaining) {
      throw new Error(`Only ${lot.quantityRemaining} ${lot.unit} of ${lot.productName} available.`);
    }
    const lineTotal = line.quantity * lot.retailPricePerUnit;
    total += lineTotal;
    return {
      inventoryLotId: lot.id,
      quantity: line.quantity,
      unitPriceSnapshot: lot.retailPricePerUnit,
      lineTotal,
    };
  });

  const order = await prisma.order.create({
    data: {
      retailerId,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      ageAttested,
      marketingOptIn,
      requestedPickupNote: requestedPickupNote?.trim() || null,
      lineItems: { create: lineData },
    },
  });

  await notify(
    retailerId,
    "customer_order_placed",
    `New pickup order from ${customerName.trim()} — ${lines.length} item${lines.length === 1 ? "" : "s"}, $${total.toFixed(2)}.`
  );

  return order;
}
