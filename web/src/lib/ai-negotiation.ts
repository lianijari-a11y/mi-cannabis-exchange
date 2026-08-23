import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notifications";
import { isRateLimited } from "@/lib/rate-limit";
import { addOfferRound, type ActorRole } from "@/lib/offers";

// AI-assisted negotiation for the core Retailer<->Grower/Processor
// threads. A party opts in on one specific open thread and gives AI a real
// price range (AiNegotiationMandate); from then on, whenever the OTHER
// party submits a human counter, this engine decides whether to accept or
// counter on the opted-in party's behalf, submitting real OfferRounds
// through the exact same addOfferRound every human negotiation already
// goes through (same anonymization boundary, same notifications, same
// Deal-creation logic — nothing new needed there).
//
// Deliberately different from every other AI feature in this app: this is
// the first one where AI writes real transaction state without a human
// confirming that specific output first. The load-bearing safety rails,
// per the approved plan:
//   - Every price is computed by a pure, deterministic step function —
//     never an LLM-guessed number. The optional LLM call in this file only
//     ever drafts cosmetic message text, wrapped so its own failure can
//     never block a real negotiation round.
//   - Every AI-submitted round is hard-clamped to the mandate's own stored
//     range AND checked for monotonicity against that mandate's own prior
//     AI price, independent of what the step function computed.
//   - AI can only accept or counter — never reject on a party's behalf.
//     Exhaustion (round cap, or the range can't move further) always
//     escalates to a human Broker, never auto-declines.
//   - Pacing: an AI-submitted round never re-triggers another automated
//     step (see the addOfferRound hook, gated on !aiGenerated) — an
//     AI-vs-AI thread only advances via a human-triggered reactive step or
//     the client-side poll, one visible step at a time, confirmed with the
//     human rather than left to resolve instantly in one chain.

const MODEL = "claude-opus-5";

type PartyRole = "retailer" | "seller";

function clampToRange(value: number, a: number, b: number): number {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return Math.min(Math.max(value, lo), hi);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Is the incoming counter already good enough to just take, regardless of
// what the step function would otherwise compute? Retailer: the seller's
// ask is at or below what I'm willing to pay. Seller: the retailer's offer
// is at or above what I'm willing to accept.
function isAcceptable(partyRole: PartyRole, incomingPrice: number, walkAwayPrice: number): boolean {
  return partyRole === "retailer" ? incomingPrice <= walkAwayPrice : incomingPrice >= walkAwayPrice;
}

// Pure, unit-testable — no LLM, no DB. Opens at openingPrice on the first
// move; each subsequent move closes half the remaining gap to the
// opposing side's last price. Hard-clamped to [opening, walkAway] and
// monotonic against this mandate's own last AI price (never moves
// backward relative to its own prior offer, even if a bug in this
// function's own math would otherwise produce that).
export function computeNextOffer(params: {
  partyRole: PartyRole;
  openingPrice: number;
  walkAwayPrice: number;
  lastOwnAiPrice: number | null;
  lastOpposingPrice: number;
  concessionFraction?: number;
}): number {
  // First move: literally the mandate holder's own stated opening price —
  // no concession math yet. Every move after that closes half the
  // remaining gap to the opposing side's last price.
  if (params.lastOwnAiPrice === null) {
    return round2(params.openingPrice);
  }
  const fraction = params.concessionFraction ?? 0.5;
  const raw = params.lastOwnAiPrice + (params.lastOpposingPrice - params.lastOwnAiPrice) * fraction;
  let next = clampToRange(raw, params.openingPrice, params.walkAwayPrice);
  next = params.partyRole === "retailer" ? Math.max(next, params.lastOwnAiPrice) : Math.min(next, params.lastOwnAiPrice);
  return round2(next);
}

function isMandateExhausted(params: {
  partyRole: PartyRole;
  walkAwayPrice: number;
  lastOwnAiPrice: number | null;
  roundsUsedAfterThis: number;
  maxRounds: number;
}): boolean {
  if (params.roundsUsedAfterThis >= params.maxRounds) return true;
  if (params.lastOwnAiPrice === null) return false;
  // Already sitting at the walk-away boundary and still hasn't converged —
  // there's nowhere left to move.
  return Math.abs(params.lastOwnAiPrice - params.walkAwayPrice) < 0.005;
}

// Mode 1 — the always-on, non-committing advisory hint. Pure, no schema,
// no engine call: just a midpoint between the two most recent opposing
// rounds, shown as a one-line suggestion above the ordinary Accept/Counter/
// Reject form. Nothing is ever written from this.
export function suggestedMidpoint(rounds: { actorRole: string; price: number | null }[]): number | null {
  const priced = rounds.filter((r): r is { actorRole: string; price: number } => r.price != null);
  if (priced.length < 2) return null;
  const last = priced[priced.length - 1];
  const opposing = [...priced].reverse().find((r) => r.actorRole !== last.actorRole);
  if (!opposing) return null;
  return round2((last.price + opposing.price) / 2);
}

async function draftAiMessage(price: number): Promise<string> {
  const fallback = `Countered at $${price} — within the approved range.`;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return fallback;
  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 100,
      system:
        "You write a single short, friendly sentence for a wholesale cannabis counter-offer message, sent on behalf of a buyer or seller who authorized AI to negotiate for them within a price range they set. State the new price naturally. No markdown, exactly one sentence, no more than 25 words.",
      output_config: { effort: "low" },
      messages: [{ role: "user", content: `New counter-offer price: $${price}` }],
    });
    const textBlock = response.content.find((b) => b.type === "text");
    const text = textBlock?.type === "text" ? textBlock.text.trim() : "";
    return text || fallback;
  } catch {
    return fallback;
  }
}

async function escalateToBroker(threadId: string, mandate: { id: string; partyId: string }): Promise<void> {
  const thread = await prisma.offerThread.update({
    where: { id: threadId },
    data: { needsBrokerMediation: true, mediationFlaggedAt: new Date() },
    include: { listing: { select: { strainName: true } } },
  });
  await prisma.aiNegotiationMandate.update({ where: { id: mandate.id }, data: { active: false } });

  const strainName = thread.listing.strainName;
  await notify(
    mandate.partyId,
    "ai_negotiation_escalated",
    `AI couldn't reach a deal on ${strainName} within your approved range — a Broker will step in to help finish this negotiation.`,
    threadId
  );
  const brokers = await prisma.user.findMany({ where: { role: "broker" }, select: { id: true } });
  await Promise.all(
    brokers.map((b) =>
      notify(
        b.id,
        "needs_mediation",
        `A negotiation on ${strainName} needs a Broker's help — AI's approved range didn't converge.`,
        threadId
      )
    )
  );
}

// The core decision. Called from (a) addOfferRound's end-of-function hook,
// right after a HUMAN counter is committed, and (b) the client-side poll
// while a thread page is open. Safe to call redundantly/concurrently for
// the same thread — every real state change is claimed via an
// optimistic-lock update before anything is written.
export async function runAiNegotiationStep(threadId: string): Promise<void> {
  try {
    const thread = await prisma.offerThread.findUnique({
      where: { id: threadId },
      include: {
        listing: { select: { pricePerUnit: true, postedById: true } },
        rounds: { orderBy: { createdAt: "desc" }, take: 1 },
        mandates: { where: { active: true } },
      },
    });
    if (!thread || thread.status !== "open" || thread.needsBrokerMediation) return;

    const lastRound = thread.rounds[0];
    if (!lastRound) return; // nothing to react to yet

    const respondingRole: PartyRole = lastRound.actorRole === "retailer" ? "seller" : "retailer";
    const mandate = thread.mandates.find((m) => m.partyRole === respondingRole);
    if (!mandate) return;

    if (await isRateLimited("ai-negotiation-round", threadId, 60_000, 20)) return;

    // Optimistic-lock claim — mirrors lib/pos.ts's atomically-guarded stock
    // decrement. If someone else (the poll, an overlapping reactive
    // trigger) already advanced this mandate, count === 0 and we bail.
    const claim = await prisma.aiNegotiationMandate.updateMany({
      where: { id: mandate.id, roundsUsed: mandate.roundsUsed },
      data: { roundsUsed: { increment: 1 } },
    });
    if (claim.count === 0) return;

    const incomingPrice = lastRound.price ?? thread.listing.pricePerUnit;

    const lastOwnAiRound = await prisma.offerRound.findFirst({
      where: { threadId, actorId: mandate.partyId, aiGenerated: true },
      orderBy: { createdAt: "desc" },
    });
    const lastOwnAiPrice = lastOwnAiRound?.price ?? null;

    if (isAcceptable(mandate.partyRole as PartyRole, incomingPrice, mandate.walkAwayPrice)) {
      try {
        await addOfferRound({
          threadId,
          actorId: mandate.partyId,
          actorRole: mandate.partyRole as ActorRole,
          action: "accept",
          price: incomingPrice,
          aiGenerated: true,
        });
      } catch {
        // A human accepted/rejected at the same instant — Deal.threadId's
        // unique constraint (or the thread-no-longer-open check) already
        // makes this race safe at the DB level. Nothing to surface.
      }
      await prisma.aiNegotiationMandate.update({ where: { id: mandate.id }, data: { active: false } });
      return;
    }

    if (
      isMandateExhausted({
        partyRole: mandate.partyRole as PartyRole,
        walkAwayPrice: mandate.walkAwayPrice,
        lastOwnAiPrice,
        roundsUsedAfterThis: mandate.roundsUsed + 1,
        maxRounds: mandate.maxRounds,
      })
    ) {
      await escalateToBroker(threadId, mandate);
      return;
    }

    const nextPrice = computeNextOffer({
      partyRole: mandate.partyRole as PartyRole,
      openingPrice: mandate.openingPrice,
      walkAwayPrice: mandate.walkAwayPrice,
      lastOwnAiPrice,
      lastOpposingPrice: incomingPrice,
    });

    const message = await draftAiMessage(nextPrice);

    try {
      await addOfferRound({
        threadId,
        actorId: mandate.partyId,
        actorRole: mandate.partyRole as ActorRole,
        action: "counter",
        price: nextPrice,
        message,
        aiGenerated: true,
      });
    } catch {
      // Same race-safety posture as the accept branch above.
    }
  } catch (err) {
    // This function is invoked from a try/catch-wrapped after() hook and
    // from a plain poll action — nothing here may ever throw out and
    // disrupt a normal human accept/counter/reject.
    console.error("runAiNegotiationStep failed:", err);
  }
}

export type MandateResult = { ok: true } | { ok: false; error: string };

// A party opts into (or updates) AI-assisted negotiation on one specific
// open thread. Authorization mirrors addOfferRound's own check exactly.
export async function createOrUpdateMandate(input: {
  threadId: string;
  partyRole: PartyRole;
  partyId: string;
  openingPrice: number;
  walkAwayPrice: number;
}): Promise<MandateResult> {
  if (!Number.isFinite(input.openingPrice) || input.openingPrice <= 0) {
    return { ok: false, error: "Enter a valid opening price." };
  }
  if (!Number.isFinite(input.walkAwayPrice) || input.walkAwayPrice <= 0) {
    return { ok: false, error: "Enter a valid walk-away price." };
  }
  if (input.partyRole === "retailer" && input.walkAwayPrice < input.openingPrice) {
    return { ok: false, error: "Your walk-away price (the most you'll pay) must be at or above your opening offer." };
  }
  if (input.partyRole === "seller" && input.walkAwayPrice > input.openingPrice) {
    return { ok: false, error: "Your walk-away price (the least you'll accept) must be at or below your opening offer." };
  }

  const thread = await prisma.offerThread.findUnique({ where: { id: input.threadId } });
  if (!thread) return { ok: false, error: "Negotiation not found." };
  if (thread.status !== "open") return { ok: false, error: "This negotiation is no longer open." };
  if (thread.needsBrokerMediation) {
    return { ok: false, error: "This negotiation is being mediated by a Broker — AI can't take it over." };
  }

  if (input.partyRole === "retailer" && input.partyId !== thread.retailerId) {
    return { ok: false, error: "Not authorized for this negotiation." };
  }
  if (input.partyRole === "seller") {
    const listing = await prisma.listing.findUnique({ where: { id: thread.listingId }, select: { postedById: true } });
    if (!listing || input.partyId !== listing.postedById) {
      return { ok: false, error: "Not authorized for this negotiation." };
    }
  }

  await prisma.aiNegotiationMandate.upsert({
    where: { threadId_partyRole: { threadId: input.threadId, partyRole: input.partyRole } },
    create: {
      threadId: input.threadId,
      partyRole: input.partyRole,
      partyId: input.partyId,
      openingPrice: input.openingPrice,
      walkAwayPrice: input.walkAwayPrice,
    },
    update: {
      openingPrice: input.openingPrice,
      walkAwayPrice: input.walkAwayPrice,
      roundsUsed: 0,
      active: true,
    },
  });

  // If it's already this party's turn (a counter from the other side is
  // already sitting there), take the opening automated step right away —
  // the common case is opting in reactively, not before anyone's moved.
  await runAiNegotiationStep(input.threadId);

  return { ok: true };
}

// "Take back control" — authorization checked against the mandate's own
// stored partyId, same posture as every other "only the party themselves"
// check in this app.
export async function deactivateMandate(threadId: string, partyRole: PartyRole, partyId: string): Promise<MandateResult> {
  const mandate = await prisma.aiNegotiationMandate.findUnique({
    where: { threadId_partyRole: { threadId, partyRole } },
  });
  if (!mandate) return { ok: false, error: "No AI negotiation to stop on this thread." };
  if (mandate.partyId !== partyId) return { ok: false, error: "Not authorized." };
  await prisma.aiNegotiationMandate.update({ where: { id: mandate.id }, data: { active: false } });
  return { ok: true };
}
