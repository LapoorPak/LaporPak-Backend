import { Router } from "express";

import { requireAuth } from "../../middleware/authMiddleware.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import {
  getSessionDetailController,
  rejectEmailOtpSignInController,
} from "./auth.controller.js";

const router = Router();

/**
 * @swagger
 * /api/auth/sign-in/email-otp:
 *   post:
 *     tags: [Auth]
 *     summary: Reject passwordless OTP sign-in
 *     responses:
 *       403:
 *         description: Passwordless OTP sign-in is disabled
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 */
router.post("/sign-in/email-otp", rejectEmailOtpSignInController);

/**
 * @swagger
 * /api/auth/session-detail:
 *   get:
 *     tags: [Auth]
 *     summary: Get current session detail
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current session detail
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiDataResponse"
 *       401:
 *         description: Unauthorized
 */
router.get("/session-detail", requireAuth, asyncHandler(getSessionDetailController));

export default router;
