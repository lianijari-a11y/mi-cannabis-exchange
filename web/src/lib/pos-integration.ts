import "server-only";
import { prisma } from "@/lib/prisma";

// Added 2026-08-16 — architecture for pushing accepted deals into a
// seller's existing POS. IMPORTANT: none of the four adapters below make a
// real API call. Dutchie/Treez/Flowhub/Cova all require becoming an
// approved/certified API partner first — a business relationship that
// hasn't happened — so every "sync" here just records an honest
// PosSyncLog row with status "stub_only" and an explanatory message.
// Do NOT change these to claim "synced" without a real, verified partner
// integration for that vendor. See CLAUDE.md §18.

export const POS_VENDORS = ["dutchie", "treez", "flowhub", "cova"] as const;
export type PosVendor = (typeof POS_VENDORS)[number];

export const POS_VENDOR_LABELS: Record<PosVendor, string> = {
  dutchie: "Dutchie",
  treez: "Treez",
  flowhub: "Flowhub",
  cova: "Cova",
};

type PosAdapter = {
  vendor: PosVendor;
  pushDeal: (params: { dealId: string; connectionId: string; apiKey: string }) => Promise<{
    status: "stub_only" | "failed";
    message: string;
  }>;
};

function makeStubAdapter(vendor: PosVendor): PosAdapter {
  return {
    vendor,
    async pushDeal() {
      return {
        status: "stub_only",
        message: `${POS_VENDOR_LABELS[vendor]} isn't actually connected yet — this platform doesn't have certified API partner access with ${POS_VENDOR_LABELS[vendor]}. This log entry exists so nobody assumes a real sync happened.`,
      };
    },
  };
}

const ADAPTERS: Record<PosVendor, PosAdapter> = {
  dutchie: makeStubAdapter("dutchie"),
  treez: makeStubAdapter("treez"),
  flowhub: makeStubAdapter("flowhub"),
  cova: makeStubAdapter("cova"),
};

export async function connectPos(userId: string, vendor: PosVendor, apiKey: string, autoSyncEnabled: boolean) {
  if (!apiKey.trim()) throw new Error("Enter an API key.");
  return prisma.posConnection.upsert({
    where: { userId },
    create: { userId, vendor, apiKey: apiKey.trim(), autoSyncEnabled },
    update: { vendor, apiKey: apiKey.trim(), autoSyncEnabled },
  });
}

export async function disconnectPos(userId: string) {
  await prisma.posConnection.deleteMany({ where: { userId } });
}

export async function posConnectionFor(userId: string) {
  return prisma.posConnection.findUnique({ where: { userId }, include: { syncLogs: { orderBy: { createdAt: "desc" }, take: 10 } } });
}

// Called from lib/offers.ts when a deal is accepted — fire-and-forget,
// never throws into the caller (a POS sync issue should never block the
// actual deal from being created).
export async function pushDealToPosIfConnected(dealId: string, sellerId: string) {
  try {
    const connection = await prisma.posConnection.findUnique({ where: { userId: sellerId } });
    if (!connection || !connection.autoSyncEnabled) return;

    const adapter = ADAPTERS[connection.vendor as PosVendor];
    const result = adapter
      ? await adapter.pushDeal({ dealId, connectionId: connection.id, apiKey: connection.apiKey })
      : { status: "failed" as const, message: `Unknown POS vendor "${connection.vendor}".` };

    await prisma.posSyncLog.create({
      data: {
        connectionId: connection.id,
        dealId,
        vendor: connection.vendor,
        status: result.status,
        message: result.message,
      },
    });
  } catch {
    // Deliberately swallowed — a POS sync failure must never break deal
    // creation, which is the actual thing that matters here.
  }
}
