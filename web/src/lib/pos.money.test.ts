import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { createSale } from "@/lib/pos";

let retailerId: string | null = null;
let lotIds: string[] = [];

afterEach(async () => {
  if (lotIds.length) {
    await prisma.saleLineItem.deleteMany({ where: { inventoryLotId: { in: lotIds } } });
    await prisma.inventoryLot.deleteMany({ where: { id: { in: lotIds } } });
  }
  if (retailerId) {
    await prisma.sale.deleteMany({ where: { retailerId } });
    await prisma.saleCounter.deleteMany({ where: { retailerId } });
    await prisma.user.deleteMany({ where: { id: retailerId } });
  }
  retailerId = null;
  lotIds = [];
});

async function makeRetailer() {
  const retailer = await prisma.user.create({
    data: {
      role: "retailer",
      email: `money-test-${crypto.randomUUID()}@example.com`,
      passwordHash: "test-fixture-not-a-real-hash",
      fullName: "Money Test Retailer",
      anonHandle: `Test Retailer #${crypto.randomUUID().slice(0, 6)}`,
      licenseVerification: "approved",
    },
  });
  retailerId = retailer.id;
  return retailer;
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
});
