import "server-only";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { setCommission, markCommissionPaid, type CommissionPayerType } from "@/lib/commission";

export async function handleSetCommission(formData: FormData) {
  const session = await requireRole("broker");

  const dealId = String(formData.get("dealId") ?? "");
  const rate = Number(formData.get("rate"));
  const payerType = String(formData.get("payerType") ?? "") as CommissionPayerType;
  const splitGrowerPctRaw = String(formData.get("splitGrowerPct") ?? "").trim();

  try {
    await setCommission({
      dealId,
      brokerId: session.user.id,
      rate,
      payerType,
      splitGrowerPct: splitGrowerPctRaw ? Number(splitGrowerPctRaw) : undefined,
    });
  } catch (err) {
    redirect(
      `/broker?error=${encodeURIComponent(
        err instanceof Error ? err.message : "Couldn't set commission terms."
      )}`
    );
  }

  redirect("/broker");
}

export async function handleMarkCommissionPaid(formData: FormData) {
  const session = await requireRole("broker");
  const dealId = String(formData.get("dealId") ?? "");
  await markCommissionPaid(dealId, session.user.id, "broker");
  redirect("/broker");
}
