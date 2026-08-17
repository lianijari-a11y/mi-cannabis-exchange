"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/dal";
import {
  createInventoryLotFromDeal,
  updateLotMarkup,
  voidLot,
  lookupLotBySku,
  createSale,
  voidSale,
  markOrderReady,
  cancelOrder,
  fulfillOrder,
} from "@/lib/pos";
import { connectSms, disconnectSms, sendSpecialsMessage } from "@/lib/marketing-sms";

export async function intakeAction(formData: FormData) {
  const session = await requireRole("retailer");
  const dealId = String(formData.get("dealId") ?? "");
  const markupPercent = Number(formData.get("markupPercent") ?? 0);
  const metrcPackageTag = String(formData.get("metrcPackageTag") ?? "");
  const thcMgRaw = String(formData.get("thcMgPerUnit") ?? "").trim();
  await createInventoryLotFromDeal(
    session.user.id,
    dealId,
    markupPercent,
    metrcPackageTag,
    thcMgRaw ? Number(thcMgRaw) : undefined
  );
  revalidatePath("/retailer/pos");
}

export async function updateMarkupAction(formData: FormData) {
  const session = await requireRole("retailer");
  const lotId = String(formData.get("lotId") ?? "");
  const markupPercent = Number(formData.get("markupPercent") ?? 0);
  await updateLotMarkup(lotId, session.user.id, markupPercent);
  revalidatePath("/retailer/pos");
}

export async function voidLotAction(formData: FormData) {
  const session = await requireRole("retailer");
  const lotId = String(formData.get("lotId") ?? "");
  await voidLot(lotId, session.user.id);
  revalidatePath("/retailer/pos");
}

export async function voidSaleAction(formData: FormData) {
  const session = await requireRole("retailer");
  const saleId = String(formData.get("saleId") ?? "");
  await voidSale(saleId, session.user.id);
  revalidatePath("/retailer/pos");
}

// Called directly from the Register client component (not a <form> action —
// the cart is built up client-side scan by scan), so it takes and returns
// plain serializable data rather than FormData.
export async function lookupSkuAction(sku: string) {
  const session = await requireRole("retailer");
  const lot = await lookupLotBySku(session.user.id, sku);
  if (!lot) return null;
  return {
    id: lot.id,
    sku: lot.sku,
    productName: lot.productName,
    unit: lot.unit,
    retailPricePerUnit: lot.retailPricePerUnit,
    quantityRemaining: lot.quantityRemaining,
    thcPercent: lot.thcPercent,
    thcMgPerUnit: lot.thcMgPerUnit,
  };
}

export async function checkoutAction(
  lines: { lotId: string; quantity: number }[],
  tenderType: "cash" | "card" | "other",
  taxRatePercent: number,
  orderType: "in_store" | "pickup" | "curbside",
  customerName?: string
) {
  const session = await requireRole("retailer");
  const sale = await createSale(session.user.id, lines, tenderType, taxRatePercent, orderType, customerName);
  revalidatePath("/retailer/pos");
  return {
    id: sale.id,
    saleNumber: sale.saleNumber,
    subtotal: sale.subtotal,
    taxAmount: sale.taxAmount,
    total: sale.total,
    tenderType: sale.tenderType,
    orderType: sale.orderType,
    customerName: sale.customerName,
    createdAt: sale.createdAt.toISOString(),
    lineItems: sale.lineItems.map((li) => ({
      productName: li.inventoryLot.productName,
      quantity: li.quantity,
      unit: li.inventoryLot.unit,
      unitPrice: li.unitPrice,
      lineTotal: li.lineTotal,
    })),
  };
}

// Called directly from OrdersPanel (client component), same convention as
// lookupSkuAction/checkoutAction above.
export async function markOrderReadyAction(orderId: string) {
  const session = await requireRole("retailer");
  await markOrderReady(orderId, session.user.id);
  revalidatePath("/retailer/pos");
}

export async function cancelOrderAction(orderId: string) {
  const session = await requireRole("retailer");
  await cancelOrder(orderId, session.user.id);
  revalidatePath("/retailer/pos");
}

export async function fulfillOrderAction(
  orderId: string,
  tenderType: "cash" | "card" | "other",
  taxRatePercent: number
) {
  const session = await requireRole("retailer");
  await fulfillOrder(orderId, session.user.id, tenderType, taxRatePercent);
  revalidatePath("/retailer/pos");
}

export async function connectSmsAction(formData: FormData) {
  const session = await requireRole("retailer");
  await connectSms(
    session.user.id,
    String(formData.get("accountSid") ?? ""),
    String(formData.get("authToken") ?? ""),
    String(formData.get("fromPhoneNumber") ?? "")
  );
  revalidatePath("/retailer/pos");
}

export async function disconnectSmsAction(_formData: FormData) {
  const session = await requireRole("retailer");
  await disconnectSms(session.user.id);
  revalidatePath("/retailer/pos");
}

export async function sendSpecialsAction(formData: FormData) {
  const session = await requireRole("retailer");
  const body = String(formData.get("body") ?? "");
  await sendSpecialsMessage(session.user.id, body);
  revalidatePath("/retailer/pos");
}
