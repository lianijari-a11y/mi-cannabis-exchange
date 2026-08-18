import "server-only";
import { randomBytes } from "crypto";
import { after } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { submitSaleToMetrc } from "@/lib/metrc-integration";
import { notify } from "@/lib/notifications";
import { CATEGORY_LABELS, LOW_STOCK_THRESHOLD, type Category } from "@/lib/constants";

// Retailer Point of Sale — see CLAUDE.md §23. This is the first place in
// the app that models an actual retail sale/inventory-on-hand, distinct
// from Deal (the wholesale purchase) and from the Dutchie/Treez/Flowhub/
// Cova PosConnection scaffolding in lib/pos-integration.ts (that's an
// unrelated, still-stub-only feature for syncing OUT to a seller's existing
// external POS — this is a native, in-app retail register for Retailers).
//
// requireRole("retailer") is enforced by the caller (server actions in
// web/src/app/retailer/pos/actions.ts), same convention as
// lib/shipments.ts/lib/commission.ts — every function here still separately
// verifies the resource belongs to the retailerId passed in, since a role
// check alone doesn't prove ownership of a specific lot/sale/deal.

function generateSku(): string {
  return `RT-${randomBytes(5).toString("hex").toUpperCase()}`;
}

// Public order-ahead storefront (CLAUDE.md §25) — the public-safe lookup
// lives in lib/storefront.ts, this is just the retailer-authenticated
// setter. Only lowercase letters/digits/hyphens so it's always a clean URL
// segment.
export async function setStorefrontSlug(retailerId: string, slug: string) {
  const clean = slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (!clean) throw new Error("Enter a store link.");
  try {
    await prisma.user.update({ where: { id: retailerId }, data: { storefrontSlug: clean } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new Error(`"${clean}" is already taken — try something else.`);
    }
    throw err;
  }
  return clean;
}

export async function setDefaultMarkupPercent(retailerId: string, markupPercent: number | null) {
  if (markupPercent !== null && markupPercent < 0) throw new Error("Markup can't be negative.");
  await prisma.user.update({ where: { id: retailerId }, data: { defaultMarkupPercent: markupPercent } });
}

// Register customer panel settings — both plain editable numbers, not
// certified lookups, same posture as defaultMarkupPercent above and the
// tax-rate field on Sale. See lib/customers.ts for what these actually
// drive (loyalty accrual rate, the purchase-limit bar).
export async function setLoyaltySettings(retailerId: string, pointsPerDollar: number | null) {
  if (pointsPerDollar !== null && pointsPerDollar < 0) throw new Error("Points per dollar can't be negative.");
  await prisma.user.update({ where: { id: retailerId }, data: { loyaltyPointsPerDollar: pointsPerDollar } });
}

export async function setDailyPurchaseLimitOz(retailerId: string, limitOz: number | null) {
  if (limitOz !== null && limitOz <= 0) throw new Error("Purchase limit must be a positive number.");
  await prisma.user.update({ where: { id: retailerId }, data: { dailyPurchaseLimitOz: limitOz } });
}

export async function availableDealsForIntake(retailerId: string) {
  return prisma.deal.findMany({
    where: { retailerId, productStatus: "accepted", inventoryLot: null },
    include: { thread: { include: { listing: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function createInventoryLotFromDeal(
  retailerId: string,
  dealId: string,
  markupPercent: number,
  metrcPackageTag?: string,
  thcMgPerUnit?: number
) {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: { thread: { include: { listing: true } }, inventoryLot: true },
  });
  if (!deal || deal.retailerId !== retailerId) throw new Error("Not authorized for this deal.");
  if (deal.productStatus !== "accepted") throw new Error("This deal hasn't been accepted yet.");
  if (deal.inventoryLot) throw new Error("This deal is already in POS inventory.");
  if (deal.finalQuantity <= 0) throw new Error("This deal has no quantity to add.");
  if (markupPercent < 0) throw new Error("Markup can't be negative.");

  const unitCost = deal.finalPrice / deal.finalQuantity;
  const retailPricePerUnit = unitCost * (1 + markupPercent / 100);
  const listing = deal.thread.listing;

  try {
    return await prisma.inventoryLot.create({
      data: {
        retailerId,
        dealId,
        sku: generateSku(),
        metrcPackageTag: metrcPackageTag?.trim() || null,
        productName: listing.strainName,
        category: listing.category,
        thcPercent: listing.thcPercent,
        thcMgPerUnit: thcMgPerUnit && thcMgPerUnit > 0 ? thcMgPerUnit : null,
        unit: listing.unit,
        quantityReceived: deal.finalQuantity,
        quantityRemaining: deal.finalQuantity,
        unitCost,
        markupPercent,
        retailPricePerUnit,
      },
    });
  } catch (err) {
    // The `deal.inventoryLot` check above reads a snapshot — under a genuine
    // race (e.g. a double-click, or two terminals working the same intake
    // queue), both calls can pass that check before either commits.
    // `InventoryLot.dealId` is @unique, so the DB itself rejects the second
    // create; catch that here instead of leaking a raw Prisma error, same
    // convention as setStorefrontSlug's own P2002 catch above.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new Error("This deal is already in POS inventory.");
    }
    throw err;
  }
}

export async function updateLotMarkup(lotId: string, retailerId: string, markupPercent: number) {
  const lot = await prisma.inventoryLot.findUnique({ where: { id: lotId } });
  if (!lot || lot.retailerId !== retailerId) throw new Error("Not authorized for this lot.");
  if (markupPercent < 0) throw new Error("Markup can't be negative.");

  return prisma.inventoryLot.update({
    where: { id: lotId },
    data: { markupPercent, retailPricePerUnit: lot.unitCost * (1 + markupPercent / 100) },
  });
}

export async function voidLot(lotId: string, retailerId: string) {
  const lot = await prisma.inventoryLot.findUnique({ where: { id: lotId } });
  if (!lot || lot.retailerId !== retailerId) throw new Error("Not authorized for this lot.");
  return prisma.inventoryLot.update({ where: { id: lotId }, data: { status: "voided" } });
}

export async function lookupLotBySku(retailerId: string, sku: string) {
  return prisma.inventoryLot.findFirst({
    where: { retailerId, sku: sku.trim(), status: "active" },
  });
}

export async function activeInventoryForRetailer(retailerId: string) {
  return prisma.inventoryLot.findMany({
    where: { retailerId, status: { not: "voided" } },
    orderBy: { createdAt: "desc" },
  });
}

export async function salesHistoryForRetailer(retailerId: string) {
  return prisma.sale.findMany({
    where: { retailerId },
    include: { lineItems: { include: { inventoryLot: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

// One Prisma transaction validates stock and decrements it; the METRC call
// happens after commit (a network call has no place inside a DB
// transaction) and is recorded back onto the Sale row — best-effort, same
// posture as pushDealToPosIfConnected in lib/pos-integration.ts. A METRC
// failure never unwinds or blocks the sale that already rang up.
export async function createSale(
  retailerId: string,
  lines: { lotId: string; quantity: number; discountAmount?: number }[],
  tenderType: "cash" | "card" | "other",
  taxRatePercent: number,
  orderType: "in_store" | "pickup" | "curbside" = "in_store",
  customerName?: string,
  customerId?: string
) {
  if (lines.length === 0) throw new Error("Cart is empty.");

  // Populated inside the transaction below, consumed by the after() block
  // once it commits — see the low-stock notification comment further down.
  const newlyLowStockLots: { productName: string; category: string }[] = [];

  // Read-only, doesn't need to be inside the transaction — a retailer's
  // loyalty rate is a rarely-changed setting, not something this specific
  // sale needs point-in-time isolation against.
  const retailerSettings = customerId
    ? await prisma.user.findUnique({ where: { id: retailerId }, select: { loyaltyPointsPerDollar: true } })
    : null;

  const sale = await prisma.$transaction(async (tx) => {
    if (customerId) {
      const customer = await tx.customer.findUnique({ where: { id: customerId } });
      if (!customer || customer.retailerId !== retailerId) throw new Error("Not authorized for this customer.");
    }

    const lots = await tx.inventoryLot.findMany({
      where: { id: { in: lines.map((l) => l.lotId) }, retailerId, status: "active" },
    });
    const lotById = new Map(lots.map((l) => [l.id, l]));

    let subtotal = 0;
    const lineData = lines.map((line) => {
      const lot = lotById.get(line.lotId);
      if (!lot) throw new Error("One of the scanned items is no longer available.");
      if (line.quantity <= 0) throw new Error(`Enter a quantity for ${lot.productName}.`);
      if (line.quantity > lot.quantityRemaining) {
        throw new Error(`Only ${lot.quantityRemaining} ${lot.unit} of ${lot.productName} left.`);
      }
      const grossLineTotal = line.quantity * lot.retailPricePerUnit;
      const discountAmount = Math.max(0, Math.min(line.discountAmount ?? 0, grossLineTotal));
      const lineTotal = grossLineTotal - discountAmount;
      subtotal += lineTotal;
      return {
        inventoryLotId: lot.id,
        quantity: line.quantity,
        unitPrice: lot.retailPricePerUnit,
        discountAmount,
        lineTotal,
      };
    });

    const taxAmount = subtotal * (taxRatePercent / 100);
    const total = subtotal + taxAmount;

    // Atomic upsert+increment against a dedicated per-retailer counter row,
    // not a SELECT MAX(saleNumber)+1 — that pattern raced under concurrent
    // checkouts at the same retailer (Sale's own @@unique([retailerId,
    // saleNumber]) is what caught it, by throwing). Postgres's row-level
    // lock on this UPDATE correctly serializes concurrent terminals at one
    // retailer/location without contending across other locations' rows.
    const counter = await tx.saleCounter.upsert({
      where: { retailerId },
      create: { retailerId, value: 1 },
      update: { value: { increment: 1 } },
    });
    const saleNumber = counter.value;

    const created = await tx.sale.create({
      data: {
        retailerId,
        saleNumber,
        subtotal,
        taxRatePercent,
        taxAmount,
        total,
        tenderType,
        orderType,
        customerName: customerName?.trim() || null,
        customerId: customerId || null,
        lineItems: { create: lineData },
      },
      include: { lineItems: { include: { inventoryLot: true } } },
    });

    // Atomically guarded decrement — the `quantityRemaining` read at the top
    // of this transaction is a snapshot, and under concurrent checkouts
    // (multiple terminals/locations) another transaction can commit against
    // the same lot in between. Re-checking stock at write time via the
    // WHERE clause, not just at read time, is what actually prevents two
    // terminals from both selling the last unit.
    for (const line of lineData) {
      const lot = lotById.get(line.inventoryLotId)!;
      const decremented = await tx.inventoryLot.updateMany({
        where: { id: lot.id, quantityRemaining: { gte: line.quantity } },
        data: { quantityRemaining: { decrement: line.quantity } },
      });
      if (decremented.count === 0) {
        throw new Error(`${lot.productName} sold out before this sale could complete — try again.`);
      }
      // Separate guarded flip to "depleted", idempotent regardless of how
      // many concurrent sales raced to zero this lot out.
      await tx.inventoryLot.updateMany({
        where: { id: lot.id, quantityRemaining: { lte: 0 } },
        data: { status: "depleted" },
      });

      // Account Executive low-stock notification (CLAUDE.md's low-stock
      // notification plan). The claim itself is atomically guarded the same
      // way the decrement above is — `lowStockNotifiedAt: null` in the WHERE
      // clause means only the one transaction that actually wins the race to
      // cross the threshold gets count===1 and queues the notification;
      // every other concurrent sale against this lot sees count===0 and
      // stays silent, so Account Executives get exactly one notification
      // per lot, not one per sale.
      const remainingAfter = lot.quantityRemaining - line.quantity;
      if (remainingAfter / lot.quantityReceived <= LOW_STOCK_THRESHOLD) {
        const claimed = await tx.inventoryLot.updateMany({
          where: { id: lot.id, lowStockNotifiedAt: null },
          data: { lowStockNotifiedAt: new Date() },
        });
        if (claimed.count === 1) {
          newlyLowStockLots.push({ productName: lot.productName, category: lot.category });
        }
      }
    }

    // Loyalty accrual — a plain Prisma `increment` (not a guarded
    // updateMany) is already safe here: unlike the stock decrement above,
    // there's no "insufficient balance" failure mode for adding points, so
    // Postgres's own row-level lock on the UPDATE is sufficient for
    // correctness under concurrent sales for the same customer.
    if (customerId && retailerSettings?.loyaltyPointsPerDollar) {
      const pointsEarned = Math.floor(total * retailerSettings.loyaltyPointsPerDollar);
      if (pointsEarned > 0) {
        await tx.customer.update({
          where: { id: customerId },
          data: { loyaltyPointsBalance: { increment: pointsEarned } },
        });
        await tx.loyaltyLedgerEntry.create({
          data: {
            customerId,
            saleId: created.id,
            points: pointsEarned,
            reason: `Earned on sale #${created.saleNumber}`,
          },
        });
      }
    }

    return created;
  }, {
    // Prisma's defaults (maxWait 2s, timeout 5s) assume light contention.
    // Under real heavy load this transaction can legitimately queue behind
    // several others racing for a row lock on the same hot lot or the same
    // retailer's SaleCounter — that queuing is Phase 0's fix working as
    // intended, not a bug, so the timeouts need enough headroom that a
    // transaction waiting its turn doesn't get killed and surfaced as a
    // raw "transaction not found" error instead of either succeeding or
    // failing with a clean, understood message.
    maxWait: 10_000,
    timeout: 10_000,
  });

  // Off the checkout critical path — a register shouldn't sit waiting on
  // METRC's latency (now with retries, see postWithRetry) before the next
  // customer can be rung up. after() runs once the response is already on
  // its way back to the client; the Sale row (and its metrcStatus) is the
  // durable record of the outcome, checked later via /admin/metrc, not
  // something the checkout flow itself waits on.
  after(async () => {
    try {
      const result = await submitSaleToMetrc(sale, sale.lineItems);
      await prisma.sale.update({
        where: { id: sale.id },
        data: { metrcStatus: result.status, metrcError: result.error ?? null },
      });
    } catch {
      // submitSaleToMetrc already catches its own errors and returns
      // "failed" rather than throwing — this is only a backstop so a truly
      // unexpected error still can't undo the sale that already completed.
    }
  });

  // Account Executive low-stock notification — confirmed with the human as
  // a deliberate, new cross-role visibility grant (retailer real identity +
  // specific product), not a quiet default: no role besides the retailer
  // itself previously saw a retailer's real identity or POS inventory
  // levels. Platform-wide to every Account Executive, matching how that
  // role's visibility already works everywhere else in this app (same
  // trust tier as Broker — see CLAUDE.md §13) rather than inventing a
  // per-retailer AE assignment concept that doesn't exist yet. Off the
  // critical path for the same reason METRC submission is — this is a
  // notify-only side effect, not something checkout should wait on.
  if (newlyLowStockLots.length > 0) {
    after(async () => {
      const [retailer, accountExecutives] = await Promise.all([
        prisma.user.findUnique({ where: { id: retailerId }, select: { businessName: true, fullName: true } }),
        prisma.user.findMany({ where: { role: "sales_rep" }, select: { id: true } }),
      ]);
      const retailerName = retailer?.businessName || retailer?.fullName || "A retailer";
      for (const lot of newlyLowStockLots) {
        const categoryLabel = CATEGORY_LABELS[lot.category as Category] ?? lot.category;
        const message = `${retailerName} is running low on ${lot.productName} (${categoryLabel}) — consider offering a matching listing.`;
        await Promise.all(accountExecutives.map((ae) => notify(ae.id, "low_stock", message)));
      }
    });
  }

  return sale;
}

export async function voidSale(saleId: string, retailerId: string) {
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: { lineItems: { include: { inventoryLot: true } } },
  });
  if (!sale || sale.retailerId !== retailerId) throw new Error("Not authorized for this sale.");
  if (sale.status !== "completed") throw new Error("This sale is already voided.");

  await prisma.$transaction(async (tx) => {
    await tx.sale.update({ where: { id: saleId }, data: { status: "voided" } });
    for (const line of sale.lineItems) {
      await tx.inventoryLot.update({
        where: { id: line.inventoryLotId },
        data: {
          quantityRemaining: line.inventoryLot.quantityRemaining + line.quantity,
          status: "active",
        },
      });
    }

    // Claw back whatever loyalty points this sale accrued — symmetric with
    // the inventory restock above. Clamped at 0 rather than blocked: if the
    // customer already redeemed those points elsewhere, voiding the sale
    // shouldn't be prevented by that, so the balance just can't go negative.
    if (sale.customerId) {
      const accrual = await tx.loyaltyLedgerEntry.findFirst({ where: { saleId } });
      if (accrual && accrual.points > 0) {
        const customer = await tx.customer.findUnique({ where: { id: sale.customerId } });
        if (customer) {
          const clawback = Math.min(accrual.points, customer.loyaltyPointsBalance);
          if (clawback > 0) {
            await tx.customer.update({
              where: { id: sale.customerId },
              data: { loyaltyPointsBalance: { decrement: clawback } },
            });
            await tx.loyaltyLedgerEntry.create({
              data: {
                customerId: sale.customerId,
                saleId,
                points: -clawback,
                reason: `Reversed — sale #${sale.saleNumber} voided`,
              },
            });
          }
        }
      }
    }
  });
}

// ---------- Customer order-ahead / pickup (CLAUDE.md §25) ----------
// Order is a pre-sale record placed by an anonymous customer via
// lib/storefront.ts's placeOrder — it never touches inventory or METRC.
// fulfillOrder below is the only place an Order becomes a real Sale.

export async function pendingOrdersForRetailer(retailerId: string) {
  return prisma.order.findMany({
    where: { retailerId, status: { in: ["placed", "ready"] } },
    include: { lineItems: { include: { inventoryLot: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function markOrderReady(orderId: string, retailerId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.retailerId !== retailerId) throw new Error("Not authorized for this order.");
  if (order.status !== "placed") throw new Error("Only a placed order can be marked ready.");
  return prisma.order.update({ where: { id: orderId }, data: { status: "ready" } });
}

export async function cancelOrder(orderId: string, retailerId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.retailerId !== retailerId) throw new Error("Not authorized for this order.");
  if (order.status === "picked_up") throw new Error("This order was already fulfilled.");
  return prisma.order.update({ where: { id: orderId }, data: { status: "canceled" } });
}

// Converts a placed/ready Order into a real Sale — reuses createSale as-is
// (same atomic decrement + METRC submit it already does for the register)
// rather than duplicating that logic. Quantities are re-validated against
// current stock here, since real walk-in sales could have moved it since
// the order was placed — the Order's own line items were never a hard
// reservation.
export async function fulfillOrder(
  orderId: string,
  retailerId: string,
  tenderType: "cash" | "card" | "other",
  taxRatePercent: number
) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { lineItems: true },
  });
  if (!order || order.retailerId !== retailerId) throw new Error("Not authorized for this order.");
  if (order.status !== "placed" && order.status !== "ready") {
    throw new Error("This order can't be fulfilled from its current status.");
  }

  const sale = await createSale(
    retailerId,
    order.lineItems.map((li) => ({ lotId: li.inventoryLotId, quantity: li.quantity })),
    tenderType,
    taxRatePercent,
    "pickup",
    order.customerName
  );

  await prisma.order.update({
    where: { id: orderId },
    data: { status: "picked_up", saleId: sale.id },
  });

  return sale;
}
