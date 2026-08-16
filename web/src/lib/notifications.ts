import "server-only";
import { prisma } from "@/lib/prisma";

export async function notify(userId: string, type: string, message: string, threadId?: string) {
  await prisma.notification.create({
    data: { userId, type, message, threadId: threadId ?? null },
  });
}

export async function notificationsFor(userId: string, limit = 20) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function unreadCount(userId: string) {
  return prisma.notification.count({ where: { userId, read: false } });
}

export async function markAllRead(userId: string) {
  await prisma.notification.updateMany({ where: { userId, read: false }, data: { read: true } });
}
