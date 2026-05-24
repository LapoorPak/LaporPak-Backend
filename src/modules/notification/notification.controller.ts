import type { Request, Response } from "express";

import {
  getUnreadNotificationCount,
  listUserNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "./notification-query.service.js";
import { buildDataResponse, buildListResponse, parsePagination } from "../../utils/apiResponse.js";

export async function listUserNotificationsController(req: Request, res: Response) {
  const pagination = parsePagination(req.query, { defaultLimit: 20, maxLimit: 100 });
  const payload = await listUserNotifications({
    userId: req.user.id,
    unread: req.query.unread === "true",
    pagination,
  });

  res.json(buildListResponse(payload.data, pagination, payload.total, payload.stats));
}

export async function getUnreadNotificationCountController(req: Request, res: Response) {
  const count = await getUnreadNotificationCount(req.user.id);
  res.json(buildDataResponse({ unreadCount: count }));
}

export async function markNotificationAsReadController(req: Request, res: Response) {
  await markNotificationAsRead({
    notificationId: String(req.params.id),
    userId: req.user.id,
  });

  res.json({ success: true });
}

export async function markAllNotificationsAsReadController(req: Request, res: Response) {
  const result = await markAllNotificationsAsRead(req.user.id);
  res.json({ success: true, count: result.count });
}
