"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { advanceShipmentStatus } from "@/lib/shipments";

export async function advanceStatus(formData: FormData) {
  const session = await requireRole("transporter");

  const shipmentId = String(formData.get("shipmentId") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  const pod = formData.get("pod");

  await advanceShipmentStatus(
    shipmentId,
    session.user.id,
    note || null,
    pod instanceof File ? pod : null
  );

  redirect(`/transporter/shipments/${shipmentId}`);
}
