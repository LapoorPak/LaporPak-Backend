import { Router } from "express";

import { prisma } from "../config/db.js";
import { AppError, requireAuth } from "../middleware/authMiddleware.js";
import { formatRelativeTime } from "../services/notificationService.js";
import { buildDataResponse, buildListResponse, parsePagination } from "../utils/apiResponse.js";

const router = Router();

// GET /api/notifications
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const unread = req.query.unread === "true";
    const pagination = parsePagination(req.query, { defaultLimit: 20, maxLimit: 100 });

    const where = {
      userId,
      ...(unread && { isRead: false }),
    };

    const [notifications, total, unreadCount, groupedByType] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: pagination.skip,
        take: pagination.take,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId, isRead: false } }),
      prisma.notification.groupBy({
        by: ["type"],
        where,
        _count: {
          _all: true,
        },
      }),
    ]);

    const mapped = notifications.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      time: formatRelativeTime(n.createdAt),
      read: n.isRead,
      tag: n.tag,
      laporanId: n.laporanId,
    }));

    res.json(
      buildListResponse(mapped, pagination, total, {
        unreadCount,
        byType: groupedByType.map((entry) => ({
          type: entry.type,
          total: entry._count._all,
        })),
      }),
    );
  } catch (error) {
    next(error);
  }
});

// GET /api/notifications/unread-count
router.get("/unread-count", requireAuth, async (req, res, next) => {
  try {
    const count = await prisma.notification.count({
      where: { userId: req.user.id, isRead: false },
    });

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
    const notificationId = String(req.params.id);

    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new AppError("Notification not found", 404);
    }

    if (notification.userId !== req.user.id) {
      throw new AppError("Forbidden", 403);
    }

    await prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true, readAt: new Date() },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/notifications/read-all
router.patch("/read-all", requireAuth, async (req, res, next) => {
  try {
    const result = await prisma.notification.updateMany({
      where: { userId: req.user.id, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });

    res.json({ success: true, count: result.count });
  } catch (error) {
    next(error);
  }
});

export default router;
