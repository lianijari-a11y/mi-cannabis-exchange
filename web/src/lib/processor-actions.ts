import "server-only";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import {
  proposeSplitContract,
  startProcessing,
  logYield,
  settleContract,
} from "@/lib/split-contracts";

export async function handleProposeSplitContract(formData: FormData) {
  const session = await requireRole("processor");

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (user?.licenseVerification !== "approved") {
    redirect(
      `/processor/sourcing?error=${encodeURIComponent(
        "Your license must be approved by an admin before you can propose a split contract."
      )}`
    );
  }

  const listingId = String(formData.get("listingId") ?? "");
  const outputProduct = String(formData.get("outputProduct") ?? "").trim();
  const splitGrowerPct = Number(formData.get("splitGrowerPct"));
  const note = String(formData.get("note") ?? "").trim();

  if (!outputProduct || !Number.isFinite(splitGrowerPct) || splitGrowerPct <= 0 || splitGrowerPct >= 100) {
    redirect(
      `/processor/sourcing?error=${encodeURIComponent(
        "Fill in an output product and a grower split between 1 and 99%."
      )}`
    );
  }

  try {
    await proposeSplitContract({
      listingId,
      processorId: session.user.id,
      outputProduct,
      splitGrowerPct,
      note: note || undefined,
    });
  } catch (err) {
    redirect(
      `/processor/sourcing?error=${encodeURIComponent(
        err instanceof Error ? err.message : "Couldn't send the proposal."
      )}`
    );
  }

  redirect("/processor/contracts");
}

export async function handleStartProcessing(formData: FormData) {
  const session = await requireRole("processor");
  const contractId = String(formData.get("contractId") ?? "");
  await startProcessing(contractId, session.user.id);
  redirect("/processor/contracts");
}

export async function handleLogYield(formData: FormData) {
  const session = await requireRole("processor");
  const contractId = String(formData.get("contractId") ?? "");
  const yieldQty = Number(formData.get("yieldQty"));
  const yieldUnit = String(formData.get("yieldUnit") ?? "").trim();

  if (!Number.isFinite(yieldQty) || yieldQty <= 0 || !yieldUnit) {
    redirect(
      `/processor/contracts?error=${encodeURIComponent("Enter a valid yield quantity and unit.")}`
    );
  }

  await logYield(contractId, session.user.id, yieldQty, yieldUnit);
  redirect("/processor/contracts");
}

export async function handleSettleContract(formData: FormData) {
  const session = await requireRole("processor");
  const contractId = String(formData.get("contractId") ?? "");
  const settlementValue = Number(formData.get("settlementValue"));

  if (!Number.isFinite(settlementValue) || settlementValue <= 0) {
    redirect(`/processor/contracts?error=${encodeURIComponent("Enter a valid settlement value.")}`);
  }

  await settleContract(contractId, session.user.id, settlementValue);
  redirect("/processor/contracts");
}
