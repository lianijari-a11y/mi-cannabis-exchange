import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { createSale, voidSale } from "@/lib/pos";

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

async function makeRetailer(loyaltyPointsPerDollar?: number) {
  const retailer = await prisma.user.create({
    data: {
      role: "retailer",
      email: `money-test-${crypto.randomUUID()}@example.com`,
      passwordHash: "test-fixture-not-a-real-hash",
      fullName: "Money Test Retailer",
      anonHandle: `Test Retailer #${crypto.randomUUID().slice(0, 6)}`,
      licenseVerification: "approved",
      loyaltyPointsPerDollar: loyaltyPointsPerDollar ?? null,
    },
  });
  retailerId = retailer.id;
  return retailer;
}

async function makeCustomer(retailerId: string) {
  const customer = await prisma.customer.create({
    data: {
      retailerId,
      name: "Money Test Customer",
      phone: `555${Math.floor(Math.random() * 10_000_000)}`,
    },
  });
  customerId = customer.id;
  return customer;
}

async function makeLot(retailerId: string, retailPricePerUnit: number, quantityRemaining = 100) {
  const lot = await prisma.inventoryLot.create({
    data: {
      retailerId,
      sku: `TEST-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      productName: "Money Test Flower",
      category: "flower",
      unit: "lb",
      quantityReceived: quantityRemaining,
      quantityRemaining,
      unitCost: retailPricePerUnit / 1.5,
      markupPercent: 50,
      retailPricePerUnit,
    },
  });
  lotIds.push(lot.id);
  return lot;
}

describe("createSale money math", () => {
  it("computes subtotal, tax, and total correctly for a single line", async () => {
    const retailer = await makeRetailer();
    const lot = await makeLot(retailer.id, 150);

    const sale = await createSale(retailer.id, [{ lotId: lot.id, quantity: 2 }], "cash", 16);

    expect(sale.subtotal).toBe(300); // 2 * 150
    expect(sale.taxAmount).toBe(48); // 300 * 0.16
    expect(sale.total).toBe(348);
  });

  it("sums multiple lines before applying tax once", async () => {
    const retailer = await makeRetailer();
    const lotA = await makeLot(retailer.id, 100);
    const lotB = await makeLot(retailer.id, 50);

    const sale = await createSale(
      retailer.id,
      [
        { lotId: lotA.id, quantity: 1 },
        { lotId: lotB.id, quantity: 3 },
      ],
      "card",
      10
    );

    expect(sale.subtotal).toBe(250); // 100 + 3*50
    expect(sale.taxAmount).toBe(25); // 250 * 0.10
    expect(sale.total).toBe(275);
  });

  it("applies zero tax correctly when taxRatePercent is 0", async () => {
    const retailer = await makeRetailer();
    const lot = await makeLot(retailer.id, 75);

    const sale = await createSale(retailer.id, [{ lotId: lot.id, quantity: 1 }], "cash", 0);

    expect(sale.taxAmount).toBe(0);
    expect(sale.total).toBe(sale.subtotal);
  });

  it("rejects an empty cart", async () => {
    const retailer = await makeRetailer();
    await expect(createSale(retailer.id, [], "cash", 16)).rejects.toThrow(/cart is empty/i);
  });

  it("rejects a quantity that exceeds stock, with a clean message", async () => {
    const retailer = await makeRetailer();
    const lot = await makeLot(retailer.id, 100, /* quantityRemaining */ 3);

    await expect(createSale(retailer.id, [{ lotId: lot.id, quantity: 5 }], "cash", 0)).rejects.toThrow(/only 3/i);
  });

  it("applies a per-line discount before tax", async () => {
    const retailer = await makeRetailer();
    const lot = await makeLot(retailer.id, 100);

    const sale = await createSale(retailer.id, [{ lotId: lot.id, quantity: 2, discountAmount: 30 }], "cash", 10);

    expect(sale.lineItems[0].discountAmount).toBe(30);
    expect(sale.lineItems[0].lineTotal).toBe(170); // 200 - 30
    expect(sale.subtotal).toBe(170);
    expect(sale.taxAmount).toBe(17); // 170 * 0.10
    expect(sale.total).toBe(187);
  });

  it("clamps a discount that exceeds the line's own value, never going negative", async () => {
    const retailer = await makeRetailer();
    const lot = await makeLot(retailer.id, 50);

    const sale = await createSale(retailer.id, [{ lotId: lot.id, quantity: 1, discountAmount: 500 }], "cash", 0);

    expect(sale.lineItems[0].lineTotal).toBe(0);
    expect(sale.subtotal).toBe(0);
  });
});

describe("createSale loyalty accrual", () => {
  it("accrues points at the retailer's configured rate and logs the ledger entry", async () => {
    const retailer = await makeRetailer(2); // 2 points per $1
    const customer = await makeCustomer(retailer.id);
    const lot = await makeLot(retailer.id, 100);

    const sale = await createSale(retailer.id, [{ lotId: lot.id, quantity: 1 }], "cash", 0, "in_store", undefined, customer.id);

    const updated = await prisma.customer.findUniqueOrThrow({ where: { id: customer.id } });
    expect(updated.loyaltyPointsBalance).toBe(200); // total $100 * 2 pts/$

    const ledger = await prisma.loyaltyLedgerEntry.findMany({ where: { customerId: customer.id } });
    expect(ledger).toHaveLength(1);
    expect(ledger[0].points).toBe(200);
    expect(ledger[0].saleId).toBe(sale.id);
  });

  it("accrues nothing when the retailer has no loyalty rate configured", async () => {
    const retailer = await makeRetailer(); // no rate
    const customer = await makeCustomer(retailer.id);
    const lot = await makeLot(retailer.id, 100);

    await createSale(retailer.id, [{ lotId: lot.id, quantity: 1 }], "cash", 0, "in_store", undefined, customer.id);

    const updated = await prisma.customer.findUniqueOrThrow({ where: { id: customer.id } });
    expect(updated.loyaltyPointsBalance).toBe(0);
  });

  it("accrues nothing for a walk-in sale with no customer attached", async () => {
    const retailer = await makeRetailer(2);
    const lot = await makeLot(retailer.id, 100);

    // No error, no customer, no ledger entry — just a normal anonymous sale.
    const sale = await createSale(retailer.id, [{ lotId: lot.id, quantity: 1 }], "cash", 0);
    expect(sale.customerId).toBeNull();
  });

  it("claws back accrued points when the sale is voided", async () => {
    const retailer = await makeRetailer(1);
    const customer = await makeCustomer(retailer.id);
    const lot = await makeLot(retailer.id, 100);

    const sale = await createSale(retailer.id, [{ lotId: lot.id, quantity: 1 }], "cash", 0, "in_store", undefined, customer.id);
    const afterSale = await prisma.customer.findUniqueOrThrow({ where: { id: customer.id } });
    expect(afterSale.loyaltyPointsBalance).toBe(100);

    await voidSale(sale.id, retailer.id);

    const afterVoid = await prisma.customer.findUniqueOrThrow({ where: { id: customer.id } });
    expect(afterVoid.loyaltyPointsBalance).toBe(0);
  });
});
