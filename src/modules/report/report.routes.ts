import { Router } from "express";

import { upload } from "../../config/upload.js";
import { requireAgencyRole, requireAuth, requireCitizenRole } from "../../middleware/authMiddleware.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import {
  createReportController,
  getReportByIdController,
  getReportDashboardController,
  listMyReportsController,
  listReportLocationsController,
  listReportsController,
  rateReportController,
  resolveReportController,
  submitReportClarificationController,
  updateReportStatusController,
  voteReportController,
} from "./report.controller.js";

const router = Router();

/**
 * @swagger
 * /api/reports:
 *   get:
 *     tags: [Reports]
 *     summary: List public reports
 *     parameters:
 *       - $ref: "#/components/parameters/page"
 *       - $ref: "#/components/parameters/limit"
 *       - $ref: "#/components/parameters/reportStatus"
 *       - $ref: "#/components/parameters/kategoriId"
 *       - $ref: "#/components/parameters/search"
 *     responses:
 *       200:
 *         description: Report list
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiListResponse"
 */
router.get("/", asyncHandler(listReportsController));

/**
 * @swagger
 * /api/reports/me:
 *   get:
 *     tags: [Reports]
 *     summary: List current user's reports
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: "#/components/parameters/page"
 *       - $ref: "#/components/parameters/limit"
 *       - $ref: "#/components/parameters/reportStatus"
 *       - $ref: "#/components/parameters/kategoriId"
 *       - $ref: "#/components/parameters/search"
 *     responses:
 *       200:
 *         description: Current user's reports
 *       401:
 *         description: Unauthorized
 */
router.get("/me", requireAuth, asyncHandler(listMyReportsController));

/**
 * @swagger
 * /api/reports/locations:
 *   get:
 *     tags: [Reports]
 *     summary: List report map locations
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: "#/components/parameters/page"
 *       - $ref: "#/components/parameters/limit"
 *       - name: scope
 *         in: query
 *         schema:
 *           type: string
 *           enum: [mine, all]
 *       - $ref: "#/components/parameters/reportStatus"
 *       - $ref: "#/components/parameters/kategoriId"
 *       - $ref: "#/components/parameters/dinasId"
 *       - $ref: "#/components/parameters/cabangDinasId"
 *       - name: createdById
 *         in: query
 *         schema:
 *           type: string
 *       - $ref: "#/components/parameters/search"
 *       - name: sort
 *         in: query
 *         schema:
 *           type: string
 *       - name: minLat
 *         in: query
 *         schema:
 *           type: number
 *       - name: maxLat
 *         in: query
 *         schema:
 *           type: number
 *       - name: minLng
 *         in: query
 *         schema:
 *           type: number
 *       - name: maxLng
 *         in: query
 *         schema:
 *           type: number
 *     responses:
 *       200:
 *         description: Report locations
 *       401:
 *         description: Unauthorized
 */
router.get("/locations", requireAuth, asyncHandler(listReportLocationsController));

/**
 * @swagger
 * /api/reports/dashboard:
 *   get:
 *     tags: [Reports]
 *     summary: Get agency report dashboard
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: "#/components/parameters/page"
 *       - $ref: "#/components/parameters/limit"
 *       - name: scope
 *         in: query
 *         schema:
 *           type: string
 *           enum: [mine, all]
 *       - name: tab
 *         in: query
 *         schema:
 *           type: string
 *           enum: [semua, baru, diproses, klarifikasi, tuntas]
 *       - $ref: "#/components/parameters/dinasId"
 *       - $ref: "#/components/parameters/cabangDinasId"
 *       - $ref: "#/components/parameters/kategoriId"
 *       - $ref: "#/components/parameters/search"
 *     responses:
 *       200:
 *         description: Agency dashboard reports
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Agency role required
 */
router.get("/dashboard", requireAuth, requireAgencyRole, asyncHandler(getReportDashboardController));

/**
 * @swagger
 * /api/reports:
 *   post:
 *     tags: [Reports]
 *     summary: Create citizen report
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: "#/components/schemas/CreateReportMultipart"
 *     responses:
 *       201:
 *         description: Report created
 *       400:
 *         description: Invalid report payload
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Citizen role required
 */
router.post("/", requireAuth, requireCitizenRole, upload.array("images", 5), asyncHandler(createReportController));

/**
 * @swagger
 * /api/reports/{id}:
 *   get:
 *     tags: [Reports]
 *     summary: Get report detail
 *     parameters:
 *       - $ref: "#/components/parameters/id"
 *     responses:
 *       200:
 *         description: Report detail
 *       404:
 *         description: Report not found
 */
router.get("/:id", asyncHandler(getReportByIdController));

/**
 * @swagger
 * /api/reports/{id}/status:
 *   post:
 *     tags: [Reports]
 *     summary: Update report status as agency
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: "#/components/parameters/id"
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: "#/components/schemas/UpdateReportStatusMultipart"
 *     responses:
 *       200:
 *         description: Report status updated
 *       400:
 *         description: Invalid status payload
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Agency role required
 */
router.post("/:id/status", requireAuth, requireAgencyRole, upload.array("images", 5), asyncHandler(updateReportStatusController));

/**
 * @swagger
 * /api/reports/{id}/clarification:
 *   post:
 *     tags: [Reports]
 *     summary: Submit citizen clarification
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: "#/components/parameters/id"
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: "#/components/schemas/SubmitClarificationMultipart"
 *     responses:
 *       200:
 *         description: Clarification submitted
 *       400:
 *         description: Invalid clarification payload
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Citizen role required
 */
router.post("/:id/clarification", requireAuth, requireCitizenRole, upload.array("images", 5), asyncHandler(submitReportClarificationController));

/**
 * @swagger
 * /api/reports/{id}/vote:
 *   post:
 *     tags: [Reports]
 *     summary: Vote report
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: "#/components/parameters/id"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/VoteReportInput"
 *     responses:
 *       200:
 *         description: Vote updated
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Citizen role required
 */
router.post("/:id/vote", requireAuth, requireCitizenRole, asyncHandler(voteReportController));

/**
 * @swagger
 * /api/reports/{id}/rating:
 *   post:
 *     tags: [Reports]
 *     summary: Rate resolved report
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: "#/components/parameters/id"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/RateReportInput"
 *     responses:
 *       200:
 *         description: Rating submitted
 *       400:
 *         description: Report is not resolved
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Citizen role required
 */
router.post("/:id/rating", requireAuth, requireCitizenRole, asyncHandler(rateReportController));

/**
 * @swagger
 * /api/reports/{id}/resolve:
 *   post:
 *     tags: [Reports]
 *     summary: Resolve report as agency
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: "#/components/parameters/id"
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: "#/components/schemas/ResolveReportMultipart"
 *     responses:
 *       200:
 *         description: Report resolved
 *       400:
 *         description: Resolution image required
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Agency role required
 */
router.post("/:id/resolve", requireAuth, requireAgencyRole, upload.array("resolutionImages", 5), asyncHandler(resolveReportController));

export default router;
