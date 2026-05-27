import type { NotificationType, Prisma } from "../generated/prisma/client.js";
import type { PaginationParams } from "../utils/apiResponse.js";

export interface NotificationData {
  type: NotificationType;
  title: string;
  message: string;
  tag: string;
  laporanId?: string;
  metadata?: Prisma.InputJsonValue;
}

export interface CreateNotificationInput extends NotificationData {
  userId: string;
}

export interface ListUserNotificationsInput {
  userId: string;
  unread?: boolean;
  pagination: PaginationParams;
}

export interface MarkNotificationAsReadInput {
  notificationId: string;
  userId: string;
}
