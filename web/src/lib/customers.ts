import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Register customer identity, purchase habits, loyalty, and purchase-limit
// tracking — see CLAUDE.md's POS hardening/customer-panel plan. Everything
// here is scoped per retailer (retailerId is always required/checked), same
// as every other retailer-owned record in this app — a Customer at one
// dispensary is invisible to another.

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

// Called from the register's customer-lookup form — types a phone number,
// gets back the existing Customer if this retailer has seen them before, or
// creates a new one. Name/notes on an existing customer are updated in
// place (the register is always the latest source of truth for that data),
// matching the "keep what's on file unless changed" convention used
// elsewhere (e.g. lib/metrc-integration.ts's connectMetrc).
export async function findOrCreateCustomer(
  retailerId: string,
  name: string,
  phone: string,
  notes?: string
) {
  const cleanPhone = normalizePhone(phone);
  if (!cleanPhone) throw new Error("Enter a phone number to look up or add a customer.");
  if (!name.trim()) throw new Error("Enter a customer name.");

  try {
    return await prisma.customer.upsert({
      where: { retailerId_phone: { retailerId, phone: cleanPhone } },
      create: { retailerId, name: name.trim(), phone: cleanPhone, notes: notes?.trim() || null },
      update: { name: name.trim(), notes: notes?.trim() || null },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      // A near-simultaneous lookup for the same phone number already
      // created the row — re-fetch rather than surface a raw conflict.
      const existing = await prisma.customer.findUnique({
        where: { retailerId_phone: { retailerId, phone: cleanPhone } },
      });
      if (existing) return existing;
    }
    throw err;
  }
}

export async function lookupCustomerByPhone(retailerId: string, phone: string) {
  const cleanPhone = normalizePhone(phone);
  if (!cleanPhone) return null;
  return prisma.customer.findUnique({ where: { retailerId_phone: { retailerId, phone: cleanPhone } } });
}

export async function customerById(retailerId: string, customerId: string) {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer || customer.retailerId !== retailerId) return null;
  return customer;
}

// Purchase habits shown on the register's customer panel — avg spend/sale,
// last-sale date, sales/month, top categories by $ spent. Computed live
// from this Customer's own completed Sales. No fabricated default for
// someone with no history yet — same honesty convention as
// lib/market.ts's sellerRating/retailerRating (a brand-new customer shows
// "no history yet", not a zero or an average of nothing).
export async function customerPurchaseHabits(customerId: string) {
  const sales = await prisma.sale.findMany({
    where: { customerId, status: "completed" },
    select: {
      total: true,
      createdAt: true,
      lineItems: { select: { lineTotal: true, inventoryLot: { select: { category: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  if (sales.length === 0) return null;

  const avgSpend = sales.reduce((sum, s) => sum + s.total, 0) / sales.length;
  const lastSaleAt = sales[0].createdAt;

  const monthsSpanned = Math.max(
    1,
    (Date.now() - sales[sales.length - 1].createdAt.getTime()) / (30 * 86_400_000)
  );
  const salesPerMonth = sales.length / monthsSpanned;

  const byCategory = new Map<string, number>();
  for (const sale of sales) {
    for (const li of sale.lineItems) {
      const cat = li.inventoryLot.category;
      byCategory.set(cat, (byCategory.get(cat) ?? 0) + li.lineTotal);
    }
  }
  const topCategories = Array.from(byCategory.entries())
    .map(([category, total]) => ({ category, avgSpend: Math.round((total / sales.length) * 100) / 100 }))
    .sort((a, b) => b.avgSpend - a.avgSpend);

  return {
    saleCount: sales.length,
    avgSpend: Math.round(avgSpend * 100) / 100,
    lastSaleAt,
    salesPerMonth: Math.round(salesPerMonth * 10) / 10,
    topCategories,
  };
}

// Purchase-limit tracking, scoped honestly — see CLAUDE.md's plan for why
// this only covers weight-sold ("lb") line items with confidence.
// Concentrate/vape/edible lines (sold by "liter" or "unit") are summed
// separately and explicitly NOT converted into the flower-equivalent
// ounces figure — this app has no certified equivalency ratio for that,
// and guessing at one in a compliance feature would be worse than not
// building it. Returns null (not a fabricated zero) when no customer is
// attached, since cross-visit tracking is exactly what a Customer record
// enables.
export async function todaysPurchaseTotals(customerId: string) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const lineItems = await prisma.saleLineItem.findMany({
    where: {
      sale: { customerId, status: "completed", createdAt: { gte: startOfDay } },
    },
    select: { quantity: true, inventoryLot: { select: { unit: true } } },
  });

  const LB_TO_OZ = 16;
  let flowerEquivalentOz = 0;
  let otherUnitsCount = 0; // liter/unit lines — tracked, not converted

  for (const li of lineItems) {
    if (li.inventoryLot.unit === "lb") {
      flowerEquivalentOz += li.quantity * LB_TO_OZ;
    } else {
      otherUnitsCount += li.quantity;
    }
  }

  return {
    flowerEquivalentOz: Math.round(flowerEquivalentOz * 100) / 100,
    otherUnitsCount: Math.round(otherUnitsCount * 100) / 100,
  };
}

// Validates the customer has enough points, then returns the discount it
// funds and logs the redemption — does not itself touch a Sale/cart total,
// the register applies the returned discountAmount to the line the staff
// picked. $0.05 per point is a plain, editable-in-spirit constant (not a
// certified rate) — same posture as every other dollar figure in this app;
// revisit if the human wants it configurable per retailer later.
const DOLLARS_PER_POINT = 0.05;

export async function redeemLoyaltyPoints(retailerId: string, customerId: string, points: number) {
  if (points <= 0) throw new Error("Enter a positive number of points to redeem.");

  return prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findUnique({ where: { id: customerId } });
    if (!customer || customer.retailerId !== retailerId) throw new Error("Not authorized for this customer.");

    const decremented = await tx.customer.updateMany({
      where: { id: customerId, loyaltyPointsBalance: { gte: points } },
      data: { loyaltyPointsBalance: { decrement: points } },
    });
    if (decremented.count === 0) {
      throw new Error(`This customer only has ${customer.loyaltyPointsBalance} points available.`);
    }

    const discountAmount = Math.round(points * DOLLARS_PER_POINT * 100) / 100;
    await tx.loyaltyLedgerEntry.create({
      data: {
        customerId,
        points: -points,
        reason: `Redeemed for $${discountAmount.toFixed(2)} off`,
      },
    });

    return { discountAmount };
  });
}
