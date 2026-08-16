"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/dal";
import {
  advanceShipmentStatus,
  proposeShipmentSchedule,
  setTransportFee,
  uploadTransportInvoice,
  markTransportFeePaid,
} from "@/lib/shipments";

export async function advanceStatus(formData: FormData) {
  const session = await requireRole("transporter");

  const shipmentId = String(formData.get("shipmentId") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  const pod = formData.get("pod");

  try {
    await advanceShipmentStatus(
      shipmentId,
      session.user.id,
      note || null,
      pod instanceof File ? pod : null
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Something went wrong.";
    redirect(`/transporter/shipments/${shipmentId}?error=${encodeURIComponent(message)}`);
  }

  redirect(`/transporter/shipments/${shipmentId}`);
}

export async function submitTransportFee(formData: FormData) {
  const session = await requireRole("transporter");
  const shipmentId = String(formData.get("shipmentId") ?? "");
  const amount = Number(formData.get("transportFeeAmount"));
  const payer = String(formData.get("transportFeePayer") ?? "split") as "grower" | "retailer" | "split";
  const splitGrowerPct = formData.get("splitGrowerPct") ? Number(formData.get("splitGrowerPct")) : undefined;

  try {
    await setTransportFee(shipmentId, session.user.id, amount, payer, splitGrowerPct);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Something went wrong.";
    redirect(`/transporter/shipments/${shipmentId}?error=${encodeURIComponent(message)}`);
  }
  redirect(`/transporter/shipments/${shipmentId}`);
}

export async function submitTransportInvoice(formData: FormData) {
  const session = await requireRole("transporter");
  const shipmentId = String(formData.get("shipmentId") ?? "");
  const file = formData.get("invoice");
  if (file instanceof File && file.size > 0) {
    await uploadTransportInvoice(shipmentId, session.user.id, file);
  }
  redirect(`/transporter/shipments/${shipmentId}`);
}

export async function confirmTransportFeePaid(formData: FormData) {
  const session = await requireRole("transporter");
  const shipmentId = String(formData.get("shipmentId") ?? "");
  await markTransportFeePaid(shipmentId, session.user.id, "transporter");
  redirect(`/transporter/shipments/${shipmentId}`);
}

export async function proposeSchedule(formData: FormData) {
  const session = await requireRole("transporter");

  const shipmentId = String(formData.get("shipmentId") ?? "");
  const pickupRaw = String(formData.get("scheduledPickupAt") ?? "").trim();
  const deliveryRaw = String(formData.get("scheduledDeliveryAt") ?? "").trim();

  await proposeShipmentSchedule(
    shipmentId,
    session.user.id,
    pickupRaw ? new Date(pickupRaw) : null,
    deliveryRaw ? new Date(deliveryRaw) : null
  );

  redirect(`/transporter/shipments/${shipmentId}`);
}
