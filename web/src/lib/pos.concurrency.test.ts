import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { createSale } from "@/lib/pos";

// The whole point of the commercial-grade POS hardening pass: prove the
// atomically-guarded decrement in createSale (web/src/lib/pos.ts) actually
// holds when multiple terminals race for the same lot, and that the
// SaleCounter-based numbering never hands out a duplicate saleNumber under
// the same concurrent load. This exercises the real Prisma transaction
// against the real (dev) database — a mocked DB can't meaningfully test
// Postgres's own row-level locking behavior, which is what's under test.

let retailerId: string | null = null;
let lotId: string | null = null;

afterEach(async () => {
  if (lotId) {
    await prisma.saleLineItem.deleteMany({ where: { inventoryLotId: lotId } });
    await prisma.inventoryLot.deleteMany({ where: { id: lotId } });
  }
  if (retailerId) {
    await prisma.sale.deleteMany({ where: { retailerId } });
    await prisma.saleCounter.deleteMany({ where: { retailerId } });
    await prisma.user.deleteMany({ where: { id: retailerId } });
  }
  retailerId = null;
  lotId = null;
});

async function makeRetailerWithLot(quantityRemaining: number) {
  const retailer = await prisma.user.create({
    data: {
      role: "retailer",
      email: `concurrency-test-${crypto.randomUUID()}@example.com`,
      passwordHash: "test-fixture-not-a-real-hash",
      fullName: "Concurrency Test Retailer",
      anonHandle: `Test Retailer #${crypto.randomUUID().slice(0, 6)}`,
      licenseVerification: "approved",
    },
  });
  const lot = await prisma.inventoryLot.create({
    data: {
      retailerId: retailer.id,
      sku: `TEST-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      productName: "Concurrency Test Flower",
      category: "flower",
      unit: "lb",
      quantityReceived: quantityRemaining,
      quantityRemaining,
      unitCost: 100,
      markupPercent: 50,
      retailPricePerUnit: 150,
    },
  });
  retailerId = retailer.id;
  lotId = lot.id;
  return { retailer, lot };
}

describe("createSale concurrency", () => {
  it("never oversells a lot when multiple terminals race for the last units", async () => {
    const STOCK = 5;
    const ATTEMPTS = 12;
    const { retailer, lot } = await makeRetailerWithLot(STOCK);

    const results = await Promise.allSettled(
      Array.from({ length: ATTEMPTS }, () => createSale(retailer.id, [{ lotId: lot.id, quantity: 1 }], "cash", 0))
    );

    const succeeded = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r) => r.status === "rejected");

    expect(succeeded).toHaveLength(STOCK);
    expect(failed).toHaveLength(ATTEMPTS - STOCK);

    // Every rejection should be one of the two clean, expected messages —
    // never a raw Prisma/DB error leaking through. Which one depends on
    // timing: "sold out" is the atomic-guard rejection when a transaction's
    // decrement loses the race; "no longer available" fires instead when a
    // transaction's own initial read happens after the lot's status has
    // already flipped to "depleted" by an earlier-completing transaction —
    // both mean the same thing (this line lost the race), neither is a bug.
    for (const r of failed) {
      if (r.status === "rejected") {
        expect(String(r.reason)).toMatch(/sold out|no longer available/i);
      }
    }

    const finalLot = await prisma.inventoryLot.findUniqueOrThrow({ where: { id: lot.id } });
    expect(finalLot.quantityRemaining).toBe(0);
    expect(finalLot.quantityRemaining).toBeGreaterThanOrEqual(0); // never negative
    expect(finalLot.status).toBe("depleted");
  });

  it("hands out distinct, gap-free sale numbers under concurrent checkouts", async () => {
    const STOCK = 8;
    const { retailer, lot } = await makeRetailerWithLot(STOCK);

    const results = await Promise.allSettled(
      Array.from({ length: STOCK }, () => createSale(retailer.id, [{ lotId: lot.id, quantity: 1 }], "cash", 0))
    );

    const saleNumbers = results
      .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof createSale>>> => r.status === "fulfilled")
      .map((r) => r.value.saleNumber)
      .sort((a, b) => a - b);

    expect(saleNumbers).toHaveLength(STOCK);
    // No duplicates, no gaps — exactly 1..STOCK.
    expect(saleNumbers).toEqual(Array.from({ length: STOCK }, (_, i) => i + 1));
  });
});
