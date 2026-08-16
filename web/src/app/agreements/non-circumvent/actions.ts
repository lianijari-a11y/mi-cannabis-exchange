"use server";

import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/dal";
import { acceptNonCircumvent } from "@/lib/agreements";
import { roleHome } from "@/lib/constants";

export async function acceptAgreement() {
  const session = await requireAuth();
  await acceptNonCircumvent(session.user.id);
  redirect(roleHome(session.user.role));
}
