import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { Role } from "@/lib/constants";

// Auth checks belong close to the data/page, not just in a layout — layouts
// don't re-run on client-side navigation. This is the real per-request check.
export async function requireRole(role: Role) {
  const session = await auth();
  if (!session?.user || session.user.role !== role) {
    redirect("/login");
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
