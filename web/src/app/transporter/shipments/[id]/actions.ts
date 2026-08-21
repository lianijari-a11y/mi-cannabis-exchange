"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/dal";
import {
  advanceShipmentStatus,
  proposeShipmentSchedule,
  setTransportFee,
  uploadTransportInvoice,
  markTransportFeePaid,
  setDriverInfo,
  setLocationSharing,
  reportShipmentLocation,
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

export async function submitDriverInfo(formData: FormData) {
  const session = await requireRole("transporter");
  const shipmentId = String(formData.get("shipmentId") ?? "");
  const driverName = String(formData.get("driverName") ?? "");
  const driverPhone = String(formData.get("driverPhone") ?? "");

  try {
    await setDriverInfo(shipmentId, session.user.id, driverName, driverPhone);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Something went wrong.";
    redirect(`/transporter/shipments/${shipmentId}?error=${encodeURIComponent(message)}`);
  }
  redirect(`/transporter/shipments/${shipmentId}`);
}

export async function toggleLocationSharing(formData: FormData) {
  const session = await requireRole("transporter");
  const shipmentId = String(formData.get("shipmentId") ?? "");
  const enabled = String(formData.get("enabled") ?? "") === "true";

  try {
    await setLocationSharing(shipmentId, session.user.id, enabled);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Something went wrong.";
    redirect(`/transporter/shipments/${shipmentId}?error=${encodeURIComponent(message)}`);
  }
  redirect(`/transporter/shipments/${shipmentId}`);
}

// Called directly from the client (not a <form> submit) — the browser's
// Geolocation API reports a new position every so often while sharing is
// on, and each one is just a plain background write, not a page
// navigation. No redirect here on purpose.
export async function reportLocationAction(shipmentId: string, lat: number, lng: number) {
  const session = await requireRole("transporter");
  try {
    await reportShipmentLocation(shipmentId, session.user.id, lat, lng);
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Failed to report location." };
  }
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
