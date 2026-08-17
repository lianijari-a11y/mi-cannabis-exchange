import "server-only";
import { prisma } from "@/lib/prisma";

// See CLAUDE.md §18. Bumping this string forces every user to re-accept —
// use it if the text below is ever replaced with real attorney-drafted
// language.
export const NON_CIRCUMVENT_VERSION = "2026-08-16-draft-v1";

// DRAFT PLACEHOLDER TEXT — NOT REVIEWED BY A MICHIGAN CANNABIS ATTORNEY.
// Same posture as every other legal-adjacent surface in this app (see
// CLAUDE.md §9): the mechanism (gate + recorded acceptance) is real, the
// clause language is a stand-in that must be replaced before real launch.
export const NON_CIRCUMVENT_TEXT = `
By using Cannabliz, you agree not to circumvent the platform:
you will not use any counterparty identity, contact information, or deal
information you obtain through this platform to negotiate, transact, or
otherwise complete a wholesale cannabis transaction directly with that
counterparty outside the platform, bypassing the Broker's negotiation and
oversight role described in this platform's terms.

This restriction applies to every party on the platform — Growers,
Processors, Retailers, Brokers, Transporters, and Sales Representatives
alike — for any deal introduced or facilitated through the platform.

This is placeholder language pending review and drafting by a licensed
Michigan cannabis attorney. It is not a substitute for that review, and the
platform operator should not rely on it as a binding agreement until that
review is complete.
`.trim();

export async function hasAcceptedNonCircumvent(userId: string) {
  const row = await prisma.agreementAcceptance.findUnique({
    where: { userId_agreementType: { userId, agreementType: "non_circumvent" } },
  });
  return row?.version === NON_CIRCUMVENT_VERSION;
}

export async function acceptNonCircumvent(userId: string) {
  await prisma.agreementAcceptance.upsert({
    where: { userId_agreementType: { userId, agreementType: "non_circumvent" } },
    create: { userId, agreementType: "non_circumvent", version: NON_CIRCUMVENT_VERSION },
    update: { version: NON_CIRCUMVENT_VERSION, acceptedAt: new Date() },
  });
}
