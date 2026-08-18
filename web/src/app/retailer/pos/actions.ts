"use server";

import { revalidatePath } from "next/cache";
import { requirePosAccess } from "@/lib/dal";
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
import {
  findOrCreateCustomer,
  lookupCustomerByPhone,
  customerPurchaseHabits,
  todaysPurchaseTotals,
  redeemLoyaltyPoints,
} from "@/lib/customers";

export async function intakeAction(formData: FormData) {
  const { retailerId } = await requirePosAccess();
  const dealId = String(formData.get("dealId") ?? "");
  const markupPercent = Number(formData.get("markupPercent") ?? 0);
  const metrcPackageTag = String(formData.get("metrcPackageTag") ?? "");
  const thcMgRaw = String(formData.get("thcMgPerUnit") ?? "").trim();
  await createInventoryLotFromDeal(
    retailerId,
    dealId,
    markupPercent,
    metrcPackageTag,
    thcMgRaw ? Number(thcMgRaw) : undefined
  );
  revalidatePath("/retailer/pos");
}

export async function updateMarkupAction(formData: FormData) {
  const { retailerId } = await requirePosAccess();
  const lotId = String(formData.get("lotId") ?? "");
  const markupPercent = Number(formData.get("markupPercent") ?? 0);
  await updateLotMarkup(lotId, retailerId, markupPercent);
  revalidatePath("/retailer/pos");
}

export async function voidLotAction(formData: FormData) {
  const { retailerId } = await requirePosAccess();
  const lotId = String(formData.get("lotId") ?? "");
  await voidLot(lotId, retailerId);
  revalidatePath("/retailer/pos");
}

export async function voidSaleAction(formData: FormData) {
  const { retailerId } = await requirePosAccess();
  const saleId = String(formData.get("saleId") ?? "");
  await voidSale(saleId, retailerId);
  revalidatePath("/retailer/pos");
}

// Called directly from the Register client component (not a <form> action —
// the cart is built up client-side scan by scan), so it takes and returns
// plain serializable data rather than FormData.
export async function lookupSkuAction(sku: string) {
  const { retailerId } = await requirePosAccess();
  const lot = await lookupLotBySku(retailerId, sku);
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
  lines: { lotId: string; quantity: number; discountAmount?: number }[],
  tenderType: "cash" | "card" | "other",
  taxRatePercent: number,
  orderType: "in_store" | "pickup" | "curbside",
  customerName?: string,
  customerId?: string
) {
  const { retailerId } = await requirePosAccess();
  const sale = await createSale(
    retailerId,
    lines,
    tenderType,
    taxRatePercent,
    orderType,
    customerName,
    customerId
  );
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
      discountAmount: li.discountAmount,
      lineTotal: li.lineTotal,
    })),
  };
}

// Called directly from the Register/CustomerPanel client components, same
// convention as lookupSkuAction — plain serializable args/return, not a
// <form> action.
async function serializedCustomer(customer: { id: string; name: string; phone: string; notes: string | null; loyaltyPointsBalance: number }) {
  const [habits, purchaseTotals] = await Promise.all([
    customerPurchaseHabits(customer.id),
    todaysPurchaseTotals(customer.id),
  ]);
  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    notes: customer.notes,
    loyaltyPointsBalance: customer.loyaltyPointsBalance,
    habits: habits ? { ...habits, lastSaleAt: habits.lastSaleAt.toISOString() } : null,
    purchaseTotals,
  };
}

export async function lookupCustomerAction(phone: string) {
  const { retailerId } = await requirePosAccess();
  const customer = await lookupCustomerByPhone(retailerId, phone);
  if (!customer) return null;
  return serializedCustomer(customer);
}

export async function saveCustomerAction(name: string, phone: string, notes?: string) {
  const { retailerId } = await requirePosAccess();
  const customer = await findOrCreateCustomer(retailerId, name, phone, notes);
  revalidatePath("/retailer/pos");
  return serializedCustomer(customer);
}

export async function redeemLoyaltyPointsAction(customerId: string, points: number) {
  const { retailerId } = await requirePosAccess();
  return redeemLoyaltyPoints(retailerId, customerId, points);
}

// Called directly from OrdersPanel (client component), same convention as
// lookupSkuAction/checkoutAction above.
export async function markOrderReadyAction(orderId: string) {
  const { retailerId } = await requirePosAccess();
  await markOrderReady(orderId, retailerId);
  revalidatePath("/retailer/pos");
}

export async function cancelOrderAction(orderId: string) {
  const { retailerId } = await requirePosAccess();
  await cancelOrder(orderId, retailerId);
  revalidatePath("/retailer/pos");
}

export async function fulfillOrderAction(
  orderId: string,
  tenderType: "cash" | "card" | "other",
  taxRatePercent: number
) {
  const { retailerId } = await requirePosAccess();
  await fulfillOrder(orderId, retailerId, tenderType, taxRatePercent);
  revalidatePath("/retailer/pos");
}

export async function connectSmsAction(formData: FormData) {
  const { retailerId } = await requirePosAccess();
  await connectSms(
    retailerId,
    String(formData.get("accountSid") ?? ""),
    String(formData.get("authToken") ?? ""),
    String(formData.get("fromPhoneNumber") ?? "")
  );
  revalidatePath("/retailer/pos");
}

export async function disconnectSmsAction(_formData: FormData) {
  const { retailerId } = await requirePosAccess();
  await disconnectSms(retailerId);
  revalidatePath("/retailer/pos");
}

export async function sendSpecialsAction(formData: FormData) {
  const { retailerId } = await requirePosAccess();
  const body = String(formData.get("body") ?? "");
  await sendSpecialsMessage(retailerId, body);
  revalidatePath("/retailer/pos");
}
