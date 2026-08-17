"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { retailerByStorefrontSlug, placeOrder } from "@/lib/storefront";
import { isRateLimited, clientIp } from "@/lib/rate-limit";

// Same Postgres-backed limiter as /api/license-lookup (lib/rate-limit.ts) —
// this is the app's other genuinely unauthenticated, spammable write
// surface. Previously an in-memory Map here too; see that route's comment
// for the full history of why that didn't hold across multiple instances.
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 10;

export async function placeOrderAction(
  slug: string,
  customerName: string,
  customerPhone: string,
  ageAttested: boolean,
  lines: { lotId: string; quantity: number }[],
  requestedPickupNote?: string,
  marketingOptIn?: boolean
) {
  const ip = clientIp(await headers());
  if (await isRateLimited("storefront-order", ip, WINDOW_MS, MAX_REQUESTS_PER_WINDOW)) {
    throw new Error("Too many orders submitted — try again in a minute.");
  }

  const retailer = await retailerByStorefrontSlug(slug);
  if (!retailer) throw new Error("This store isn't available.");

  const order = await placeOrder(
    retailer.id,
    customerName,
    customerPhone,
    ageAttested,
    lines,
    requestedPickupNote,
    marketingOptIn
  );
  redirect(`/order/${slug}/confirmation/${order.id}`);
}
