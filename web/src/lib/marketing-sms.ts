import "server-only";
import { prisma } from "@/lib/prisma";
import { encryptSecret, decryptSecret } from "@/lib/crypto";

// SCAFFOLDING ONLY — see CLAUDE.md §28/§29. sendSpecialsMessage below never
// makes a real Twilio API call, regardless of whether a connection is on
// file. This is a deliberate, permanent stance for this specific feature
// (not a "no real access yet" placeholder like the Dutchie/Treez stubs in
// lib/pos-integration.ts) — "today's specials" is promotional messaging,
// TCPA-regulated, and this app's data model only just started capturing
// real opt-in consent (Order.marketingOptIn, added alongside this file).
// Do not wire a live send here without the human explicitly asking for it
// again, with actual consent numbers in front of them.

function maskSecret(value: string): string {
  if (value.length <= 4) return "••••";
  return `••••${value.slice(-4)}`;
}

export async function connectSms(
  retailerId: string,
  accountSid: string,
  authToken: string,
  fromPhoneNumber: string
) {
  const trimmedToken = authToken.trim();
  if (!accountSid.trim() || !fromPhoneNumber.trim()) {
    throw new Error("Enter an Account SID and a from-number.");
  }
  const existing = trimmedToken ? null : await prisma.smsConnection.findUnique({ where: { retailerId } });
  if (!trimmedToken && !existing) throw new Error("Enter a Twilio Auth Token.");
  const encryptedToken = trimmedToken ? encryptSecret(trimmedToken) : existing!.authToken;

  return prisma.smsConnection.upsert({
    where: { retailerId },
    create: { retailerId, accountSid: accountSid.trim(), authToken: encryptedToken, fromPhoneNumber: fromPhoneNumber.trim() },
    update: { accountSid: accountSid.trim(), authToken: encryptedToken, fromPhoneNumber: fromPhoneNumber.trim() },
  });
}

export async function disconnectSms(retailerId: string) {
  await prisma.smsConnection.deleteMany({ where: { retailerId } });
}

export async function smsConnectionFor(retailerId: string) {
  const connection = await prisma.smsConnection.findUnique({ where: { retailerId } });
  if (!connection) return null;
  return { ...connection, authToken: maskSecret(decryptSecret(connection.authToken)) };
}

// Distinct phone numbers among this retailer's own pickup orders that
// opted in — the only real consent signal this app has. Never joins
// against another retailer's customers.
export async function optedInCustomerCount(retailerId: string): Promise<number> {
  const rows = await prisma.order.findMany({
    where: { retailerId, marketingOptIn: true },
    select: { customerPhone: true },
    distinct: ["customerPhone"],
  });
  return rows.length;
}

export async function messageHistoryForRetailer(retailerId: string) {
  return prisma.marketingMessage.findMany({
    where: { retailerId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
}

// Always records "stub_only" — see the module-level comment. Still useful
// on purpose: it tells the retailer exactly how many opted-in customers
// *would* have received this, and leaves an honest paper trail rather than
// silently doing nothing.
export async function sendSpecialsMessage(retailerId: string, body: string) {
  const trimmed = body.trim();
  if (!trimmed) throw new Error("Write a message first.");

  const recipientCount = await optedInCustomerCount(retailerId);

  return prisma.marketingMessage.create({
    data: {
      retailerId,
      body: trimmed,
      recipientCount,
      status: "stub_only",
      message:
        recipientCount === 0
          ? "Not sent — no customers have opted in to marketing texts yet, and there's no live SMS integration in this app regardless."
          : `Not actually sent — this platform doesn't make live Twilio (or any SMS) calls yet, even with a connection on file. This log entry exists so nobody assumes ${recipientCount} customer${recipientCount === 1 ? "" : "s"} received a real text.`,
    },
  });
}
