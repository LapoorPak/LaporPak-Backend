import { Router } from "express";

import { prisma } from "../config/db.js";
import { AppError, requireAuth } from "../middleware/authMiddleware.js";
import { formatRelativeTime } from "../services/notificationService.js";

const router = Router();

// GET /api/notifications
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const unread = req.query.unread === "true";
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const where = {
      userId,
      ...(unread && { isRead: false }),
    };

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId, isRead: false } }),
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

    res.json({
      notifications: mapped,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      unreadCount,
    });
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

    res.json({ count });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/notifications/:id/read
router.patch("/:id/read", requireAuth, async (req, res, next) => {
  try {
    const notification = await prisma.notification.findUnique({
      where: { id: req.params.id },
    });

    if (!notification) {
      throw new AppError("Notification not found", 404);
    }

    if (notification.userId !== req.user.id) {
      throw new AppError("Forbidden", 403);
    }

    await prisma.notification.update({
      where: { id: req.params.id },
      data: { isRead: true },
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
      data: { isRead: true },
    });

    res.json({ success: true, count: result.count });
  } catch (error) {
    next(error);
  }
});

export default router;
