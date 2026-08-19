import "server-only";
import { prisma } from "@/lib/prisma";
import { addOfferRound } from "@/lib/offers";

// A cart order (CLAUDE.md §41) can span several sellers/products at once
// — an Account Executive needs a way to see the ones touching their own
// accounts and to pull the whole thing back if a retailer/grower situation
// changes before the seller responds. This never invents a second
// cancellation mechanism: it just calls the ordinary per-thread "reject"
// (lib/offers.ts's addOfferRound) on every line still open, acting with
// the listing's own seller identity — the same "AE acts as the seller
// they're assigned to" posture already used for editing a listing on
// their behalf (CLAUDE.md §13/§38), not a new kind of authority.
export async function ordersForActor(actorRole: "sales_rep" | "admin", actorId: string) {
  const orders = await prisma.cartOrder.findMany({
    where:
      actorRole === "admin"
        ? {}
        : { threads: { some: { listing: { postedBy: { assignedSalesRepId: actorId } } } } },
    include: {
      retailer: { select: { anonHandle: true } },
      threads: {
        include: {
          listing: {
            select: {
              strainName: true,
              category: true,
              unit: true,
              postedById: true,
              postedBy: { select: { businessName: true, fullName: true, assignedSalesRepId: true } },
            },
          },
          rounds: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // For an AE (not Admin), only surface the lines actually theirs — a
  // multi-seller collection order can include lines belonging to a
  // different rep's own account, which this rep has no standing over.
  return orders
    .map((order) => ({
      id: order.id,
      createdAt: order.createdAt,
      requestedTerms: order.requestedTerms,
      retailerHandle: order.retailer.anonHandle,
      lines: order.threads
        .filter((t) => actorRole === "admin" || t.listing.postedBy.assignedSalesRepId === actorId)
        .map((t) => ({
          threadId: t.id,
          status: t.status,
          strainName: t.listing.strainName,
          unit: t.listing.unit,
          sellerLabel: t.listing.postedBy.businessName ?? t.listing.postedBy.fullName,
          latestRound: t.rounds[0]
            ? { action: t.rounds[0].action, price: t.rounds[0].price, quantity: t.rounds[0].quantity }
            : null,
        })),
    }))
    .filter((o) => o.lines.length > 0);
}

export type CancelCartOrderResult = { ok: true; canceledCount: number } | { ok: false; error: string };

export async function cancelCartOrder(
  actorRole: "sales_rep" | "admin",
  actorId: string,
  cartOrderId: string
): Promise<CancelCartOrderResult> {
  const threads = await prisma.offerThread.findMany({
    where: { cartOrderId, status: "open" },
    include: {
      listing: { select: { postedById: true, postedBy: { select: { assignedSalesRepId: true } } } },
    },
  });

  const mine = threads.filter(
    (t) => actorRole === "admin" || t.listing.postedBy.assignedSalesRepId === actorId
  );
  if (mine.length === 0) {
    return { ok: false, error: "Nothing open left to cancel on this order." };
  }

  let canceledCount = 0;
  for (const t of mine) {
    try {
      await addOfferRound({
        threadId: t.id,
        actorId: t.listing.postedById,
        actorRole: "seller",
        action: "reject",
        message: "Canceled by the seller's Account Executive.",
      });
      canceledCount++;
    } catch {
      // Already closed by the time we got here (e.g. the seller just
      // responded themselves) — skip it, don't fail the whole batch over
      // one line that's no longer open.
    }
  }
  return { ok: true, canceledCount };
}
