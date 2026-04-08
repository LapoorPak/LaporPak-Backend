import { Router } from "express";

import { requireAuth } from "../middleware/authMiddleware.js";
import {
  getUnreadNotificationCount,
  listUserNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "../services/notificationQueryService.js";
import { buildDataResponse, buildListResponse, parsePagination } from "../utils/apiResponse.js";

const router = Router();

// GET /api/notifications
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query, { defaultLimit: 20, maxLimit: 100 });
    const payload = await listUserNotifications({
      userId: req.user.id,
      unread: req.query.unread === "true",
      pagination,
    });

    res.json(
      buildListResponse(payload.data, pagination, payload.total, payload.stats),
    );
  } catch (error) {
    next(error);
  }
});

// GET /api/notifications/unread-count
router.get("/unread-count", requireAuth, async (req, res, next) => {
  try {
    const count = await getUnreadNotificationCount(req.user.id);

    res.json(
      buildDataResponse({
        unreadCount: count,
      }),
    );
  } catch (error) {
    next(error);
  }
});

// PATCH /api/notifications/:id/read
router.patch("/:id/read", requireAuth, async (req, res, next) => {
  try {
    await markNotificationAsRead({
      notificationId: String(req.params.id),
      userId: req.user.id,
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/notifications/read-all
router.patch("/read-all", requireAuth, async (req, res, next) => {
  try {
    const result = await markAllNotificationsAsRead(req.user.id);

    res.json({ success: true, count: result.count });
  } catch (error) {
    next(error);
  }
});

export default router;
