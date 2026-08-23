import "server-only";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notifications";

// A flagged (needsBrokerMediation) thread's own escalation is one-way — a
// Broker never writes to OfferThread/OfferRound directly. This deliberately
// stops short of granting Broker new negotiation-write authority: real-world
// brokering is suggesting/mediating, not unilaterally committing someone
// else's money. A suggestion renders to both parties as a banner with a
// "Counter at $X" button that pre-fills the *existing* Accept/Counter/Reject
// form — the party still submits their own real round through the normal
// human path. Authorization mirrors lib/commission.ts's setCommission
// exactly: requireRole("broker") one layer up, no per-thread ownership
// check — any broker, any thread, matching CLAUDE.md decision #2's
// platform-wide Broker visibility.
export async function suggestPrice(input: {
  threadId: string;
  brokerId: string;
  suggestedPrice: number;
  message?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!Number.isFinite(input.suggestedPrice) || input.suggestedPrice <= 0) {
    return { ok: false, error: "Enter a valid suggested price." };
  }

  const thread = await prisma.offerThread.findUnique({
    where: { id: input.threadId },
    include: { listing: { select: { strainName: true, postedById: true } } },
  });
  if (!thread) return { ok: false, error: "Negotiation not found." };
  if (thread.status !== "open") return { ok: false, error: "This negotiation is no longer open." };

  await prisma.brokerSuggestion.create({
    data: {
      threadId: input.threadId,
      brokerId: input.brokerId,
      suggestedPrice: input.suggestedPrice,
      message: input.message?.trim() || null,
    },
  });

  const text = `A Broker suggested $${input.suggestedPrice}/unit to help close the negotiation on ${thread.listing.strainName}.`;
  await notify(thread.retailerId, "broker_suggestion", text, thread.id);
  await notify(thread.listing.postedById, "broker_suggestion", text, thread.id);

  return { ok: true };
}

// Dismissing a suggestion (either party can mark it resolved once they've
// acted on it, or a broker can mark their own withdrawn) just stops it from
// showing as an active banner — it never mutates the negotiation itself.
export async function resolveBrokerSuggestion(suggestionId: string): Promise<void> {
  await prisma.brokerSuggestion.update({
    where: { id: suggestionId },
    data: { resolvedAt: new Date() },
  });
}
