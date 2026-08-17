import "server-only";
import { prisma } from "@/lib/prisma";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import type { Sale, SaleLineItem, InventoryLot } from "@prisma/client";

// Added 2026-08-16 (second ask) — originally SCAFFOLDING ONLY: this module
// stored credentials but never made a METRC API call, because CLAUDE.md §2
// flags that it isn't established whether "Broker" (this platform's core
// role, full visibility into every deal) is a recognized MI license
// category for wholesale transfers.
//
// submitSaleToMetrc below (added for the Retailer POS module, CLAUDE.md
// §23) is a deliberate, explicit exception to that scaffolding-only
// posture — the human directly instructed that §2's broker-licensing
// caveat is set aside for POS/METRC specifically ("Brokers are legal for
// now... all POS systems must connect to metric") and confirmed live
// submission is required, not optional. This is the ONLY real outbound
// METRC API call anywhere in this codebase. Do not extend this pattern to
// wholesale Deal/manifest submission without the same kind of explicit
// instruction — §2's caveat is still in force everywhere else.
//
// Credentials are encrypted at rest (see lib/crypto.ts) as of the same
// change — they authenticate a real external call now, not just sit in the
// database unused.

// userApiKey left blank on an existing connection means "keep the key I
// already have on file" (the settings form never re-displays a real or
// masked key into an editable input — see components/metrc-settings.tsx —
// so there's nothing meaningful to resubmit unless the user typed a new one).
export async function connectMetrc(userId: string, licenseNumber: string, userApiKey: string) {
  const trimmedKey = userApiKey.trim();
  const existing = trimmedKey ? null : await prisma.metrcConnection.findUnique({ where: { userId } });
  if (!trimmedKey && !existing) throw new Error("Enter a METRC User API Key.");
  const encrypted = trimmedKey ? encryptSecret(trimmedKey) : existing!.userApiKey;
  return prisma.metrcConnection.upsert({
    where: { userId },
    create: { userId, licenseNumber: licenseNumber.trim() || null, userApiKey: encrypted },
    update: { licenseNumber: licenseNumber.trim() || null, userApiKey: encrypted },
  });
}

export async function disconnectMetrc(userId: string) {
  await prisma.metrcConnection.deleteMany({ where: { userId } });
}

export async function metrcConnectionFor(userId: string) {
  const connection = await prisma.metrcConnection.findUnique({ where: { userId } });
  if (!connection) return null;
  // The caller never needs the raw key just to render "connected" state —
  // give back a masked view and keep decryptSecret only for the actual
  // outbound call in submitSaleToMetrc.
  return { ...connection, userApiKey: maskKey(decryptSecret(connection.userApiKey)) };
}

// Internal — only submitSaleToMetrc needs the real key.
async function metrcConnectionWithRealKey(userId: string) {
  const connection = await prisma.metrcConnection.findUnique({ where: { userId } });
  if (!connection) return null;
  return { ...connection, userApiKey: decryptSecret(connection.userApiKey) };
}

function maskKey(key: string): string {
  if (key.length <= 4) return "••••";
  return `••••${key.slice(-4)}`;
}

// Blank input keeps whatever key is already on file — same reasoning as
// connectMetrc above (the form never re-displays the real/masked key into
// an editable input, so a blank submit isn't "the user wants to clear it").
export async function setMetrcVendorApiKey(vendorApiKey: string) {
  const trimmed = vendorApiKey.trim();
  if (!trimmed) return;
  await prisma.metrcVendorConfig.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", vendorApiKey: encryptSecret(trimmed) },
    update: { vendorApiKey: encryptSecret(trimmed) },
  });
}

export async function setMetrcUseSandbox(useSandbox: boolean) {
  await prisma.metrcVendorConfig.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", useSandbox },
    update: { useSandbox },
  });
}

export async function metrcVendorConfig() {
  const config = await prisma.metrcVendorConfig.findUnique({ where: { id: "singleton" } });
  if (!config) return null;
  return { ...config, vendorApiKey: config.vendorApiKey ? maskKey(decryptSecret(config.vendorApiKey)) : null };
}

async function metrcVendorConfigWithRealKey() {
  return prisma.metrcVendorConfig.findUnique({ where: { id: "singleton" } });
}

// Every licensee connection, for Admin's overview — real business identity,
// same trust tier as everywhere else Admin looks at the full user list.
export async function allMetrcConnectionsForAdmin() {
  const connections = await prisma.metrcConnection.findMany({
    include: { user: { select: { businessName: true, fullName: true, role: true } } },
    orderBy: { connectedAt: "desc" },
  });
  return connections.map((c) => ({ ...c, userApiKey: maskKey(decryptSecret(c.userApiKey)) }));
}

// ---------- Live sales-receipt submission (Retailer POS, CLAUDE.md §23) ----------

const METRC_PROD_BASE = "https://api-mi.metrc.com";
const METRC_SANDBOX_BASE = "https://sandbox-api-mi.metrc.com";

type SubmitResult = { status: "submitted" | "failed" | "skipped_no_tag"; error?: string };

// MI METRC (like other states' METRC deployments) enforces a per-license
// rate limit — under real multi-terminal/multi-location load, near-
// simultaneous sales can trigger a 429, and a transient 5xx/network blip is
// also not worth failing permanently on. Retried with jittered exponential
// backoff; a 4xx OTHER than 429 (bad credentials, malformed request) is not
// retried since retrying an inherently-invalid request just wastes time.
const MAX_ATTEMPTS = 4;
const BASE_DELAY_MS = 500;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postWithRetry(url: string, init: RequestInit): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, init);
      const retryable = res.status === 429 || res.status >= 500;
      if (res.ok || !retryable || attempt === MAX_ATTEMPTS) return res;
    } catch (err) {
      lastErr = err;
      if (attempt === MAX_ATTEMPTS) throw err;
    }
    const jitter = Math.random() * BASE_DELAY_MS;
    await sleep(BASE_DELAY_MS * 2 ** (attempt - 1) + jitter);
  }
  // Unreachable given the loop above always returns or throws on the last
  // attempt, but keeps TypeScript happy about the return type.
  throw lastErr ?? new Error("METRC request failed after retries.");
}

// Called from lib/pos.ts's createSale right after a sale is recorded —
// best-effort, same posture as pushDealToPosIfConnected in
// lib/pos-integration.ts: a METRC hiccup is recorded on the Sale row, never
// thrown back to block the sale that already happened at the register.
export async function submitSaleToMetrc(
  sale: Sale,
  lineItems: (SaleLineItem & { inventoryLot: InventoryLot })[]
): Promise<SubmitResult> {
  if (lineItems.some((li) => !li.inventoryLot.metrcPackageTag)) {
    return { status: "skipped_no_tag" };
  }

  try {
    const [connection, vendorConfig] = await Promise.all([
      metrcConnectionWithRealKey(sale.retailerId),
      metrcVendorConfigWithRealKey(),
    ]);
    if (!connection) return { status: "failed", error: "No METRC connection on file for this retailer." };
    if (!connection.licenseNumber) return { status: "failed", error: "METRC connection has no license number on file." };
    if (!vendorConfig?.vendorApiKey) return { status: "failed", error: "Platform METRC vendor API key isn't configured (Admin > METRC)." };

    const vendorApiKey = decryptSecret(vendorConfig.vendorApiKey);
    const baseUrl = vendorConfig.useSandbox ? METRC_SANDBOX_BASE : METRC_PROD_BASE;

    // Payload shape per METRC's published Sales Receipts API — POST
    // /sales/v1/receipts?licenseNumber=... Not exercised against a live
    // METRC sandbox in this environment (no real credentials here) — see
    // CLAUDE.md §23's caveat. Built to the documented contract; the request
    // shape and this function's error handling are what's verified locally.
    const receipt = {
      SalesDateTime: sale.createdAt.toISOString(),
      SalesCustomerType: "Consumer",
      Transactions: lineItems.map((li) => ({
        PackageLabel: li.inventoryLot.metrcPackageTag,
        Quantity: li.quantity,
        UnitOfMeasure: li.inventoryLot.unit,
        TotalAmount: li.lineTotal,
      })),
    };

    const res = await postWithRetry(
      `${baseUrl}/sales/v1/receipts?licenseNumber=${encodeURIComponent(connection.licenseNumber)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Basic " + Buffer.from(`${vendorApiKey}:${connection.userApiKey}`).toString("base64"),
        },
        body: JSON.stringify([receipt]),
      }
    );

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { status: "failed", error: `METRC returned ${res.status}: ${body.slice(0, 500)}` };
    }
    return { status: "submitted" };
  } catch (err) {
    return { status: "failed", error: err instanceof Error ? err.message : "Unknown error calling METRC." };
  }
}

// Recent Sale METRC outcomes across every retailer, for Admin's compliance
// oversight — reuses /admin/metrc rather than a new route.
export async function recentSaleMetrcOutcomes() {
  return prisma.sale.findMany({
    where: { metrcStatus: { not: "not_submitted" } },
    select: {
      id: true,
      saleNumber: true,
      metrcStatus: true,
      metrcError: true,
      createdAt: true,
      retailer: { select: { businessName: true, fullName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 25,
  });
}
