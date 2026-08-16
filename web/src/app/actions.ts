"use server";

import { signOut, auth } from "@/auth";
import { markAllRead } from "@/lib/notifications";

export async function logout() {
  await signOut({ redirectTo: "/" });
}

export async function markNotificationsRead() {
  const session = await auth();
  if (!session?.user) return;
  await markAllRead(session.user.id);
}
