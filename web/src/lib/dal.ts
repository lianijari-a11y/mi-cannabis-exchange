import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { Role } from "@/lib/constants";
import { hasAcceptedNonCircumvent } from "@/lib/agreements";

// Roles that must accept the platform's non-circumvention agreement before
// reaching their portal — every marketplace participant. Admin is the
// platform operator, not a party to the agreement, so it's excluded.
const NON_CIRCUMVENT_GATED_ROLES: Role[] = [
  "grower",
  "processor",
  "retailer",
  "broker",
  "transporter",
  "sales_rep",
];

// Auth checks belong close to the data/page, not just in a layout — layouts
// don't re-run on client-side navigation. This is the real per-request check.
export async function requireRole(role: Role) {
  const session = await auth();
  if (!session?.user || session.user.role !== role) {
    redirect("/login");
  }
  if (NON_CIRCUMVENT_GATED_ROLES.includes(role) && !(await hasAcceptedNonCircumvent(session.user.id))) {
    redirect("/agreements/non-circumvent");
  }
  return session;
}

export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return session;
}
