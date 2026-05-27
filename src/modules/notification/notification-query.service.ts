import { prisma } from "../../config/db.js";
import { AppError } from "../../middleware/authMiddleware.js";
import type {
  ListUserNotificationsInput,
  MarkNotificationAsReadInput,
} from "../../types/notification.js";
import { formatRelativeTime } from "./notification.service.js";

export async function listUserNotifications(input: ListUserNotificationsInput) {
  const where = {
    userId: input.userId,
    ...(input.unread ? { isRead: false } : {}),
  };

  const [notifications, total, unreadCount, groupedByType] = await Promise.all([
    prisma.trNotification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: input.pagination.skip,
      take: input.pagination.take,
    }),
    prisma.trNotification.count({ where }),
    prisma.trNotification.count({ where: { userId: input.userId, isRead: false } }),
    prisma.trNotification.groupBy({
      by: ["type"],
      where,
      _count: {
        _all: true,
      },
    }),
  ]);

  return {
    data: notifications.map((notification) => ({
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      time: formatRelativeTime(notification.createdAt),
      read: notification.isRead,
      tag: notification.tag,
      laporanId: notification.laporanId,
      metadata: notification.metadata,
    })),
    total,
    stats: {
      unreadCount,
      byType: groupedByType.map((entry) => ({
        type: entry.type,
        total: entry._count._all,
      })),
    },
  };
}

export async function getUnreadNotificationCount(userId: string) {
  return prisma.trNotification.count({
    where: { userId, isRead: false },
  });
}

export async function markNotificationAsRead(input: MarkNotificationAsReadInput) {
  const notification = await prisma.trNotification.findUnique({
    where: { id: input.notificationId },
  });

  if (!notification) {
    throw new AppError("Notification not found", 404);
  }

  if (notification.userId !== input.userId) {
    throw new AppError("Forbidden", 403);
  }

  await prisma.trNotification.update({
    where: { id: input.notificationId },
    data: { isRead: true, readAt: new Date() },
  });
}

export async function markAllNotificationsAsRead(userId: string) {
  return prisma.trNotification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
}
