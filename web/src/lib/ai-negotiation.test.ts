import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { getOrCreateThread, addOfferRound, threadsForRetailer, threadsForSeller } from "@/lib/offers";
import {
  computeNextOffer,
  createOrUpdateMandate,
  runAiNegotiationStep,
  suggestedMidpoint,
} from "@/lib/ai-negotiation";

let sellerId: string | null = null;
let retailerId: string | null = null;
let brokerId: string | null = null;
let listingId: string | null = null;
let threadId: string | null = null;

afterEach(async () => {
  if (threadId) {
    await prisma.notification.deleteMany({ where: { threadId } });
    await prisma.brokerSuggestion.deleteMany({ where: { threadId } });
    await prisma.aiNegotiationMandate.deleteMany({ where: { threadId } });
    await prisma.deal.deleteMany({ where: { threadId } });
    await prisma.offerRound.deleteMany({ where: { threadId } });
    await prisma.offerThread.deleteMany({ where: { id: threadId } });
  }
  if (listingId) await prisma.listing.deleteMany({ where: { id: listingId } });
  if (sellerId) await prisma.user.deleteMany({ where: { id: sellerId } });
  if (retailerId) await prisma.user.deleteMany({ where: { id: retailerId } });
  if (brokerId) await prisma.user.deleteMany({ where: { id: brokerId } });
  sellerId = null;
  retailerId = null;
  brokerId = null;
  listingId = null;
  threadId = null;
});

async function makeUser(role: string) {
  const uid = crypto.randomUUID();
  return prisma.user.create({
    data: {
      role,
      email: `ai-negotiation-test-${uid}@example.com`,
      passwordHash: "test-fixture-not-a-real-hash",
      fullName: `AI Negotiation Test ${role}`,
      anonHandle: `Test ${role} #${uid.slice(0, 6)}`,
      licenseVerification: "approved",
    },
  });
}

async function makeFixtures(opts?: { pricePerUnit?: number }) {
  const seller = await makeUser("grower");
  const retailer = await makeUser("retailer");
  sellerId = seller.id;
  retailerId = retailer.id;

  const listing = await prisma.listing.create({
    data: {
      postedById: seller.id,
      strainName: "AI Test Strain",
      category: "flower",
      quantity: 100,
      unit: "lb",
      pricePerUnit: opts?.pricePerUnit ?? 1000,
      terms: "cash",
    },
  });
  listingId = listing.id;

  const thread = await getOrCreateThread(listing.id, retailer.id);
  threadId = thread.id;

  return { seller, retailer, listing, thread };
}

// Inserts a round directly via Prisma, bypassing addOfferRound's own
// end-of-function hook entirely. Used where a test needs full deterministic
// control over when runAiNegotiationStep runs — addOfferRound's hook fires
// fire-and-forget in this test environment (see vitest.setup.ts's after()
// shim), which is fine for the tests that rely on it, but would otherwise
// race against these tests' own explicit calls.
async function insertHumanRound(tId: string, actorId: string, actorRole: "retailer" | "seller", price: number) {
  return prisma.offerRound.create({
    data: { threadId: tId, actorId, actorRole, action: "counter", price, aiGenerated: false },
  });
}

describe("computeNextOffer", () => {
  it("opens at openingPrice on the first move", () => {
    const next = computeNextOffer({
      partyRole: "retailer",
      openingPrice: 800,
      walkAwayPrice: 1000,
      lastOwnAiPrice: null,
      lastOpposingPrice: 1000,
    });
    expect(next).toBe(800);
  });

  it("moves the retailer up toward the opposing price, clamped to walkAway", () => {
    const next = computeNextOffer({
      partyRole: "retailer",
      openingPrice: 800,
      walkAwayPrice: 900,
      lastOwnAiPrice: 800,
      lastOpposingPrice: 1500, // way beyond walkAway
    });
    expect(next).toBe(900); // clamped, never exceeds what the retailer approved
  });

  it("moves the seller down toward the opposing price, clamped to walkAway", () => {
    const next = computeNextOffer({
      partyRole: "seller",
      openingPrice: 1200,
      walkAwayPrice: 1000,
      lastOwnAiPrice: 1200,
      lastOpposingPrice: 100, // way below walkAway
    });
    expect(next).toBe(1000);
  });

  it("never moves backward relative to its own last AI price (monotonicity guard)", () => {
    // Retailer already offered 850; a worse incoming counter (lower than
    // what the retailer already offered) must not pull the next offer back
    // down below 850.
    const next = computeNextOffer({
      partyRole: "retailer",
      openingPrice: 800,
      walkAwayPrice: 900,
      lastOwnAiPrice: 850,
      lastOpposingPrice: 500,
    });
    expect(next).toBeGreaterThanOrEqual(850);
  });
});

describe("suggestedMidpoint", () => {
  it("returns null with fewer than two priced rounds", () => {
    expect(suggestedMidpoint([])).toBeNull();
    expect(suggestedMidpoint([{ actorRole: "retailer", price: 900 }])).toBeNull();
  });

  it("computes the midpoint between the two most recent opposing rounds", () => {
    const mid = suggestedMidpoint([
      { actorRole: "seller", price: 1000 },
      { actorRole: "retailer", price: 800 },
    ]);
    expect(mid).toBe(900);
  });
});

describe("createOrUpdateMandate — opt-in takes the immediate move when it's already this party's turn", () => {
  it("seller opting in reacts right away to a retailer counter already on the table", async () => {
    const { seller, retailer, thread } = await makeFixtures({ pricePerUnit: 1000 });

    await addOfferRound({
      threadId: thread.id,
      actorId: retailer.id,
      actorRole: "retailer",
      action: "counter",
      price: 900,
    });

    const before = await prisma.offerRound.count({ where: { threadId: thread.id } });
    expect(before).toBe(1);

    const result = await createOrUpdateMandate({
      threadId: thread.id,
      partyRole: "seller",
      partyId: seller.id,
      openingPrice: 1000,
      walkAwayPrice: 950,
    });
    expect(result.ok).toBe(true);

    const rounds = await prisma.offerRound.findMany({
      where: { threadId: thread.id },
      orderBy: { createdAt: "asc" },
    });
    // The opt-in itself should have triggered one automated seller round —
    // not zero (the common real case is opting in *in response to* a
    // counter already sitting there).
    expect(rounds).toHaveLength(2);
    expect(rounds[1].actorId).toBe(seller.id);
    expect(rounds[1].aiGenerated).toBe(true);
    // 900 is below the seller's walk-away (950), so it's not acceptable —
    // the engine should counter, not accept.
    expect(rounds[1].action).toBe("counter");
  });

  it("rejects an inverted range (retailer walk-away below opening)", async () => {
    const { retailer, thread } = await makeFixtures();
    const result = await createOrUpdateMandate({
      threadId: thread.id,
      partyRole: "retailer",
      partyId: retailer.id,
      openingPrice: 900,
      walkAwayPrice: 800,
    });
    expect(result.ok).toBe(false);
  });
});

describe("runAiNegotiationStep — reacts only to the OTHER party's mandate", () => {
  it("a retailer's own manual counter never triggers the retailer's own mandate", async () => {
    const { seller, retailer, thread } = await makeFixtures({ pricePerUnit: 1000 });

    // Retailer has an active mandate...
    await createOrUpdateMandate({
      threadId: thread.id,
      partyRole: "retailer",
      partyId: retailer.id,
      openingPrice: 800,
      walkAwayPrice: 950,
    });

    // ...then the retailer themselves submits a manual (non-AI) counter —
    // bypassing the UI's own "hide manual controls while a mandate is
    // active" guard, to prove the engine itself is safe even if called.
    await addOfferRound({
      threadId: thread.id,
      actorId: retailer.id,
      actorRole: "retailer",
      action: "counter",
      price: 820,
      aiGenerated: false,
    });

    const roundsBefore = await prisma.offerRound.count({ where: { threadId: thread.id } });

    // Simulate the reactive hook directly (avoids waiting on after()).
    await runAiNegotiationStep(thread.id);

    const roundsAfter = await prisma.offerRound.count({ where: { threadId: thread.id } });
    // The seller has no mandate, so nothing should fire — confirms the
    // engine determined "whose turn" as the seller (opposite of the actor
    // who just moved), not the retailer's own mandate.
    expect(roundsAfter).toBe(roundsBefore);

    const sellerRound = await prisma.offerRound.findFirst({ where: { threadId: thread.id, actorId: seller.id } });
    expect(sellerRound).toBeNull();
  });
});

describe("runAiNegotiationStep — exhaustion escalates to Broker mediation", () => {
  it("hitting maxRounds deactivates the mandate and flags the thread for mediation, never auto-declining", async () => {
    const { seller, retailer, thread } = await makeFixtures({ pricePerUnit: 1000 });
    const broker = await makeUser("broker");
    brokerId = broker.id;

    // Direct insert — sidesteps addOfferRound's own fire-and-forget hook
    // (see insertHumanRound's comment) so this test's own explicit call
    // below is the only thing driving the engine.
    await insertHumanRound(thread.id, retailer.id, "retailer", 500); // far outside any acceptable seller range

    await prisma.aiNegotiationMandate.create({
      data: {
        threadId: thread.id,
        partyRole: "seller",
        partyId: seller.id,
        openingPrice: 1000,
        walkAwayPrice: 950,
        maxRounds: 1, // exhausted on the very first claimed round
      },
    });

    await runAiNegotiationStep(thread.id);

    const thread2 = await prisma.offerThread.findUniqueOrThrow({ where: { id: thread.id } });
    expect(thread2.needsBrokerMediation).toBe(true);
    expect(thread2.status).toBe("open"); // still open — AI never rejects on a party's behalf

    const mandate = await prisma.aiNegotiationMandate.findUniqueOrThrow({
      where: { threadId_partyRole: { threadId: thread.id, partyRole: "seller" } },
    });
    expect(mandate.active).toBe(false);

    const brokerNotified = await prisma.notification.findFirst({ where: { userId: broker.id, threadId: thread.id } });
    expect(brokerNotified).not.toBeNull();

    // Exhaustion is checked before ever committing to a price move — no
    // counter/accept round should have been submitted.
    const aiRounds = await prisma.offerRound.count({ where: { threadId: thread.id, aiGenerated: true } });
    expect(aiRounds).toBe(0);
  });
});

describe("runAiNegotiationStep — concurrency", () => {
  it("N parallel calls at the same mandate state produce exactly one AI round, never a race-created duplicate", async () => {
    const { seller, retailer, thread } = await makeFixtures({ pricePerUnit: 1000 });

    await insertHumanRound(thread.id, retailer.id, "retailer", 700);

    await prisma.aiNegotiationMandate.create({
      data: {
        threadId: thread.id,
        partyRole: "seller",
        partyId: seller.id,
        openingPrice: 1000,
        walkAwayPrice: 950,
        maxRounds: 5,
      },
    });

    const ATTEMPTS = 8;
    await Promise.all(Array.from({ length: ATTEMPTS }, () => runAiNegotiationStep(thread.id)));

    const mandate = await prisma.aiNegotiationMandate.findUniqueOrThrow({
      where: { threadId_partyRole: { threadId: thread.id, partyRole: "seller" } },
    });
    // All 8 calls race for the identical initial roundsUsed=0 claim — the
    // optimistic lock (updateMany with roundsUsed as part of the WHERE)
    // means exactly one wins.
    expect(mandate.roundsUsed).toBe(1);

    const aiRounds = await prisma.offerRound.count({
      where: { threadId: thread.id, actorId: seller.id, aiGenerated: true },
    });
    expect(aiRounds).toBe(1);
  });
});

describe("anonymization — a party's read never includes the other party's mandate", () => {
  it("threadsForRetailer never returns the seller's mandate, threadsForSeller never returns the retailer's", async () => {
    const { seller, retailer, thread } = await makeFixtures();

    await createOrUpdateMandate({
      threadId: thread.id,
      partyRole: "seller",
      partyId: seller.id,
      openingPrice: 1000,
      walkAwayPrice: 900,
    });
    await createOrUpdateMandate({
      threadId: thread.id,
      partyRole: "retailer",
      partyId: retailer.id,
      openingPrice: 800,
      walkAwayPrice: 950,
    });

    const retailerThreads = await threadsForRetailer(retailer.id);
    const rThread = retailerThreads.find((t) => t.id === thread.id);
    expect(rThread).toBeDefined();
    for (const m of rThread!.mandates) {
      expect(m.partyRole).toBe("retailer");
      expect(m.partyId).toBe(retailer.id);
    }

    const sellerThreads = await threadsForSeller(seller.id);
    const sThread = sellerThreads.find((t) => t.id === thread.id);
    expect(sThread).toBeDefined();
    for (const m of sThread!.mandates) {
      expect(m.partyRole).toBe("seller");
      expect(m.partyId).toBe(seller.id);
    }
  });
});
