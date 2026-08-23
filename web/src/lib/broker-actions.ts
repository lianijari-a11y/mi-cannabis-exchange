import "server-only";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { setCommission, markCommissionPaid, type CommissionPayerType } from "@/lib/commission";
import { suggestPrice } from "@/lib/broker-mediation";

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

// A Broker's suggestion on a thread flagged for mediation — never a direct
// negotiation write, see lib/broker-mediation.ts.
export async function handleSuggestPrice(formData: FormData) {
  const session = await requireRole("broker");
  const threadId = String(formData.get("threadId") ?? "");
  const suggestedPrice = Number(formData.get("suggestedPrice"));
  const message = String(formData.get("message") ?? "").trim();

  const result = await suggestPrice({
    threadId,
    brokerId: session.user.id,
    suggestedPrice,
    message: message || undefined,
  });
  if (!result.ok) {
    redirect(`/broker?error=${encodeURIComponent(result.error)}`);
  }
  redirect("/broker");
}
