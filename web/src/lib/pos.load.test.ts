import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { createSale } from "@/lib/pos";

// Local load test — Phase 4 of the POS hardening plan. Deliberately NOT a
// `.test.ts` file so it doesn't run as part of the regular `npm test`
// suite (it's slow and heavier than a unit/integration test belongs being
// on every run); invoke explicitly via `npm run test:load`. Uses k6-style
// thinking (many concurrent "terminals" hammering shared inventory over a
// sustained run) without adding k6 itself — no hosted account needed
// either way, this just reuses the Vitest runtime already wired up with
// the right module aliases/shims (see vitest.setup.ts) rather than fighting
// tsx/node module resolution for "server-only" and next/server's after()
// a second time.
//
// This is what actually proves Phase 0's atomic-decrement fix holds under
// realistic *sustained* concurrent load across multiple locations and
// multiple products at once — not just the single adversarial burst on one
// row that the Vitest concurrency test (pos.concurrency.test.ts) already
// covers. Watches for exactly the failure modes called out in the plan:
// negative quantityRemaining, duplicate saleNumber values, or a sale
// failing for any reason other than the two clean, expected messages.

const LOCATIONS = 3;
const TERMINALS_PER_LOCATION = 4;
const LOTS_PER_LOCATION = 5;
const ATTEMPTS_PER_TERMINAL = 15;
// Deliberately small so most locations' catalogs run genuinely low on at
// least one item during the run — real contention, not just raw volume.
const STOCK_PER_LOT_RANGE: [number, number] = [4, 40];

type LotFixture = { id: string; productName: string };
type LocationFixture = { retailerId: string; lots: LotFixture[] };

async function seed(): Promise<LocationFixture[]> {
  const locations: LocationFixture[] = [];
  for (let l = 0; l < LOCATIONS; l++) {
    const retailer = await prisma.user.create({
      data: {
        role: "retailer",
        email: `load-test-loc${l}-${crypto.randomUUID()}@example.com`,
        passwordHash: "test-fixture-not-a-real-hash",
        fullName: `Load Test Location ${l + 1}`,
        anonHandle: `Load Test #${crypto.randomUUID().slice(0, 6)}`,
        licenseVerification: "approved",
      },
    });
    const lots: LotFixture[] = [];
    for (let p = 0; p < LOTS_PER_LOCATION; p++) {
      const [min, max] = STOCK_PER_LOT_RANGE;
      const stock = Math.floor(min + Math.random() * (max - min));
      const lot = await prisma.inventoryLot.create({
        data: {
          retailerId: retailer.id,
          sku: `LOAD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
          productName: `Load Test Product ${p + 1}`,
          category: "flower",
          unit: "lb",
          quantityReceived: stock,
          quantityRemaining: stock,
          unitCost: 100,
          markupPercent: 50,
          retailPricePerUnit: 150,
        },
      });
      lots.push({ id: lot.id, productName: lot.productName });
    }
    locations.push({ retailerId: retailer.id, lots });
  }
  return locations;
}

async function cleanup(locations: LocationFixture[]) {
  const retailerIds = locations.map((l) => l.retailerId);
  const lotIds = locations.flatMap((l) => l.lots.map((lot) => lot.id));
  await prisma.saleLineItem.deleteMany({ where: { inventoryLotId: { in: lotIds } } });
  await prisma.sale.deleteMany({ where: { retailerId: { in: retailerIds } } });
  await prisma.saleCounter.deleteMany({ where: { retailerId: { in: retailerIds } } });
  await prisma.inventoryLot.deleteMany({ where: { id: { in: lotIds } } });
  await prisma.user.deleteMany({ where: { id: { in: retailerIds } } });
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTerminal(location: LocationFixture, terminalLabel: string) {
  const outcomes: { ok: boolean; ms: number; message?: string }[] = [];
  for (let i = 0; i < ATTEMPTS_PER_TERMINAL; i++) {
    const lot = pickRandom(location.lots);
    const start = performance.now();
    try {
      await createSale(location.retailerId, [{ lotId: lot.id, quantity: 1 }], "cash", 16);
      outcomes.push({ ok: true, ms: performance.now() - start });
    } catch (err) {
      outcomes.push({ ok: false, ms: performance.now() - start, message: err instanceof Error ? err.message : String(err) });
    }
    // Small jitter between a terminal's own attempts — real cashiers don't
    // scan literally back-to-back with zero gap, but different terminals
    // still overlap heavily with each other, which is the actual thing
    // under test.
    await sleep(Math.random() * 40);
  }
  return outcomes;
}

describe("POS load test", () => {
  it(
    `simulates ${LOCATIONS} locations x ${TERMINALS_PER_LOCATION} terminals x ${ATTEMPTS_PER_TERMINAL} attempts`,
    async () => {
      const locations = await seed();
      try {
        const started = performance.now();
        const perLocationResults = await Promise.all(
          locations.map((location) =>
            Promise.all(
              Array.from({ length: TERMINALS_PER_LOCATION }, (_, t) => runTerminal(location, `loc-terminal-${t}`))
            )
          )
        );
        const wallClockMs = performance.now() - started;

        const allOutcomes = perLocationResults.flat(2);
        const succeeded = allOutcomes.filter((o) => o.ok);
        const failed = allOutcomes.filter((o) => !o.ok);
        const unexpectedFailures = failed.filter(
          (o) => !/sold out|no longer available/i.test(o.message ?? "")
        );

        const latencies = succeeded.map((o) => o.ms).sort((a, b) => a - b);
        const p50 = latencies[Math.floor(latencies.length * 0.5)] ?? 0;
        const p95 = latencies[Math.floor(latencies.length * 0.95)] ?? 0;
        const max = latencies[latencies.length - 1] ?? 0;

        // eslint-disable-next-line no-console
        console.log(`
POS load test summary
----------------------
Wall clock:        ${(wallClockMs / 1000).toFixed(1)}s
Total attempts:     ${allOutcomes.length}
Succeeded:          ${succeeded.length}
Failed (expected):  ${failed.length - unexpectedFailures.length}
Failed (UNEXPECTED):${unexpectedFailures.length}
Checkout latency:   p50=${p50.toFixed(0)}ms  p95=${p95.toFixed(0)}ms  max=${max.toFixed(0)}ms
`);

        if (unexpectedFailures.length > 0) {
          // eslint-disable-next-line no-console
          console.log("Unexpected failure messages:", unexpectedFailures.map((f) => f.message));
        }

        expect(unexpectedFailures).toHaveLength(0);

        // No lot anywhere in the run ended up oversold.
        for (const location of locations) {
          for (const lot of location.lots) {
            const finalLot = await prisma.inventoryLot.findUniqueOrThrow({ where: { id: lot.id } });
            expect(finalLot.quantityRemaining).toBeGreaterThanOrEqual(0);
          }

          // No duplicate saleNumbers within a retailer/location.
          const sales = await prisma.sale.findMany({ where: { retailerId: location.retailerId } });
          const saleNumbers = sales.map((s) => s.saleNumber);
          expect(new Set(saleNumbers).size).toBe(saleNumbers.length);
        }
      } finally {
        await cleanup(locations);
      }
    },
    120_000
  );
});
