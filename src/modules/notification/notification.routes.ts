import { Router } from "express";

import { requireAuth } from "../../middleware/authMiddleware.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import {
  getUnreadNotificationCountController,
  listUserNotificationsController,
  markAllNotificationsAsReadController,
  markNotificationAsReadController,
} from "./notification.controller.js";

const router = Router();

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     tags: [Notifications]
 *     summary: List current user's notifications
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: "#/components/parameters/page"
 *       - $ref: "#/components/parameters/limit"
 *       - name: unread
 *         in: query
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Notification list
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiListResponse"
 *       401:
 *         description: Unauthorized
 */
router.get("/", requireAuth, asyncHandler(listUserNotificationsController));

/**
 * @swagger
 * /api/notifications/unread-count:
 *   get:
 *     tags: [Notifications]
 *     summary: Get unread notification count
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Unread count
 *       401:
 *         description: Unauthorized
 */
router.get("/unread-count", requireAuth, asyncHandler(getUnreadNotificationCountController));

/**
 * @swagger
 * /api/notifications/read-all:
 *   patch:
 *     tags: [Notifications]
 *     summary: Mark all notifications as read
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Notifications marked as read
 *       401:
 *         description: Unauthorized
 */
router.patch("/read-all", requireAuth, asyncHandler(markAllNotificationsAsReadController));

/**
 * @swagger
 * /api/notifications/{id}/read:
 *   patch:
 *     tags: [Notifications]
 *     summary: Mark notification as read
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: "#/components/parameters/id"
 *     responses:
 *       200:
 *         description: Notification marked as read
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Notification not found
 */
router.patch("/:id/read", requireAuth, asyncHandler(markNotificationAsReadController));

export default router;
