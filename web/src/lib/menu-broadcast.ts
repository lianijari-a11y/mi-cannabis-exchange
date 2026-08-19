import "server-only";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { notify } from "@/lib/notifications";
import { createMenuCollection, menusForCollectionPicker, menusForAdminCollectionPicker } from "@/lib/menu-collections";

export const BROADCAST_TARGET_ROLES = ["retailer", "processor"] as const;
export type BroadcastTargetRole = (typeof BROADCAST_TARGET_ROLES)[number];

// "Share menus with a link, next to that we should have share with all
// retailers, share with all processors" — the manual collection builder
// (menu-collections.ts) already covers "hand-pick specific menus, copy a
// link, send it yourself." This is the one-click version: bundle every one
// of the actor's own currently shareable menus into a single collection
// (same createMenuCollection machinery) and push that link to every user
// of the chosen role platform-wide, via the existing in-app notification
// bell — this app has no email/SMS sending infrastructure anywhere
// (documented throughout CLAUDE.md, e.g. §28/§29's Twilio stub), so an
// in-app notification is the real, working mechanism, not a placeholder
// for a future one.
//
// Retailers can act on the resulting link immediately through the
// existing cart/negotiate flow at /collection/[id]. Processors get the
// same link for visibility only — this app has no processor-side
// cart/checkout flow (a Processor's own wholesale sourcing is the
// separate SplitContract flow at /processor/sourcing, CLAUDE.md §10), so
// this is informational parity, not a claim a Processor can check out a
// cart today.
export async function broadcastAllMenus(
  actorRole: "sales_rep" | "admin",
  targetRole: BroadcastTargetRole
) {
  const session = await requireRole(actorRole);

  const menus =
    actorRole === "admin" ? await menusForAdminCollectionPicker() : await menusForCollectionPicker(session.user.id);
  if (menus.length === 0) {
    return { ok: false as const, error: "No shareable menus to send yet." };
  }

  const collection = await createMenuCollection(
    session.user.id,
    menus.map((m) => m.batchId)
  );

  const recipients = await prisma.user.findMany({
    where: { role: targetRole },
    select: { id: true },
  });

  const totalProducts = menus.reduce((n, m) => n + m.activeCount, 0);
  const message =
    `New menu bundle available — ${totalProducts} product${totalProducts === 1 ? "" : "s"} across ` +
    `${menus.length} menu${menus.length === 1 ? "" : "s"}. View and order: /collection/${collection.id}`;

  await Promise.all(recipients.map((r) => notify(r.id, "menu_broadcast", message)));

  return { ok: true as const, collectionId: collection.id, notifiedCount: recipients.length };
}
