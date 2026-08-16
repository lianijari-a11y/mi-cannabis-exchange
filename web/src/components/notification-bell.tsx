import { auth } from "@/auth";
import { notificationsFor, unreadCount } from "@/lib/notifications";
import { NotificationBellClient } from "@/components/notification-bell-client";

export async function NotificationBell() {
  const session = await auth();
  if (!session?.user) return null;

  const [notifications, unread] = await Promise.all([
    notificationsFor(session.user.id),
    unreadCount(session.user.id),
  ]);

  return <NotificationBellClient notifications={notifications} unreadCount={unread} />;
}
