import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { createSale } from "@/lib/pos";
import { customerPurchaseHabits, todaysPurchaseTotals, findOrCreateCustomer } from "@/lib/customers";

let retailerId: string | null = null;
let lotIds: string[] = [];
let customerId: string | null = null;

afterEach(async () => {
  if (lotIds.length) {
    await prisma.saleLineItem.deleteMany({ where: { inventoryLotId: { in: lotIds } } });
    await prisma.inventoryLot.deleteMany({ where: { id: { in: lotIds } } });
  }
  if (customerId) {
    await prisma.loyaltyLedgerEntry.deleteMany({ where: { customerId } });
  }
  if (retailerId) {
    await prisma.sale.deleteMany({ where: { retailerId } });
    await prisma.customer.deleteMany({ where: { retailerId } });
    await prisma.saleCounter.deleteMany({ where: { retailerId } });
    await prisma.user.deleteMany({ where: { id: retailerId } });
  }
  retailerId = null;
  lotIds = [];
  customerId = null;
});

async function makeRetailer() {
  const retailer = await prisma.user.create({
    data: {
      role: "retailer",
      email: `customers-test-${crypto.randomUUID()}@example.com`,
      passwordHash: "test-fixture-not-a-real-hash",
      fullName: "Customers Test Retailer",
      anonHandle: `Test Retailer #${crypto.randomUUID().slice(0, 6)}`,
      licenseVerification: "approved",
    },
  });
  retailerId = retailer.id;
  return retailer;
}

async function makeLot(retailerIdParam: string, unit: string, retailPricePerUnit: number, category = "flower") {
  const lot = await prisma.inventoryLot.create({
    data: {
      retailerId: retailerIdParam,
      sku: `TEST-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      productName: "Habits Test Product",
      category,
      unit,
      quantityReceived: 100,
      quantityRemaining: 100,
      unitCost: retailPricePerUnit / 1.5,
      markupPercent: 50,
      retailPricePerUnit,
    },
  });
  lotIds.push(lot.id);
  return lot;
}

describe("findOrCreateCustomer", () => {
  it("normalizes phone numbers so formatting differences still match the same customer", async () => {
    const retailer = await makeRetailer();
    const first = await findOrCreateCustomer(retailer.id, "Jane Doe", "(555) 123-4567");
    customerId = first.id;
    const second = await findOrCreateCustomer(retailer.id, "Jane Doe", "555-123-4567");

    expect(second.id).toBe(first.id);
  });

  it("rejects a blank phone number", async () => {
    const retailer = await makeRetailer();
    await expect(findOrCreateCustomer(retailer.id, "No Phone", "")).rejects.toThrow(/phone/i);
  });
});

describe("customerPurchaseHabits", () => {
  it("returns null for a customer with no completed sales yet — no fabricated default", async () => {
    const retailer = await makeRetailer();
    const customer = await findOrCreateCustomer(retailer.id, "Fresh Customer", "5551234567");
    customerId = customer.id;

    const habits = await customerPurchaseHabits(customer.id);
    expect(habits).toBeNull();
  });

  it("computes average spend and sale count across multiple sales", async () => {
    const retailer = await makeRetailer();
    const customer = await findOrCreateCustomer(retailer.id, "Repeat Customer", "5559876543");
    customerId = customer.id;

    const lotA = await makeLot(retailer.id, "lb", 100);
    const lotB = await makeLot(retailer.id, "lb", 50);

    await createSale(retailer.id, [{ lotId: lotA.id, quantity: 1 }], "cash", 0, "in_store", undefined, customer.id);
    await createSale(retailer.id, [{ lotId: lotB.id, quantity: 1 }], "cash", 0, "in_store", undefined, customer.id);

    const habits = await customerPurchaseHabits(customer.id);
    expect(habits?.saleCount).toBe(2);
    expect(habits?.avgSpend).toBe(75); // (100 + 50) / 2
  });
});

describe("todaysPurchaseTotals", () => {
  it("sums weight-sold (lb) lines into flower-equivalent ounces", async () => {
    const retailer = await makeRetailer();
    const customer = await findOrCreateCustomer(retailer.id, "Limit Test Customer", "5551112222");
    customerId = customer.id;

    const lot = await makeLot(retailer.id, "lb", 100);
    await createSale(retailer.id, [{ lotId: lot.id, quantity: 1 }], "cash", 0, "in_store", undefined, customer.id);

    const totals = await todaysPurchaseTotals(customer.id);
    expect(totals.flowerEquivalentOz).toBe(16); // 1 lb = 16 oz
    expect(totals.otherUnitsCount).toBe(0);
  });

  it("tracks unit/liter-sold lines separately, not converted into flower-equivalent ounces", async () => {
    const retailer = await makeRetailer();
    const customer = await findOrCreateCustomer(retailer.id, "Concentrate Customer", "5553334444");
    customerId = customer.id;

    const lot = await makeLot(retailer.id, "unit", 20, "edible");
    await createSale(retailer.id, [{ lotId: lot.id, quantity: 3 }], "cash", 0, "in_store", undefined, customer.id);

    const totals = await todaysPurchaseTotals(customer.id);
    expect(totals.flowerEquivalentOz).toBe(0);
    expect(totals.otherUnitsCount).toBe(3);
  });
});
