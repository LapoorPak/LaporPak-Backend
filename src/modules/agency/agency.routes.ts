import { Router } from "express";

import {
  getAgencyByIdController,
  getAgencyStatsController,
  listAgenciesController,
  listAgencyLocationsController,
  listAgencyReportsController,
} from "./agency.controller.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const router = Router();

/**
 * @swagger
 * /api/agencies:
 *   get:
 *     tags: [Agencies]
 *     summary: List agencies
 *     parameters:
 *       - $ref: "#/components/parameters/page"
 *       - $ref: "#/components/parameters/limit"
 *       - $ref: "#/components/parameters/search"
 *       - name: type
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Agency list
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiListResponse"
 */
router.get("/", asyncHandler(listAgenciesController));

/**
 * @swagger
 * /api/agencies/locations:
 *   get:
 *     tags: [Agencies]
 *     summary: List agency office map locations
 *     parameters:
 *       - $ref: "#/components/parameters/search"
 *       - $ref: "#/components/parameters/dinasId"
 *       - name: type
 *         in: query
 *         schema:
 *           type: string
 *       - name: cityRegency
 *         in: query
 *         schema:
 *           type: string
 *       - name: wilayah
 *         in: query
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Agency locations
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiDataResponse"
 */
router.get("/locations", asyncHandler(listAgencyLocationsController));

/**
 * @swagger
 * /api/agencies/{id}:
 *   get:
 *     tags: [Agencies]
 *     summary: Get agency detail
 *     parameters:
 *       - $ref: "#/components/parameters/id"
 *     responses:
 *       200:
 *         description: Agency detail
 *       404:
 *         description: Agency not found
 */
router.get("/:id", asyncHandler(getAgencyByIdController));

/**
 * @swagger
 * /api/agencies/{id}/stats:
 *   get:
 *     tags: [Agencies]
 *     summary: Get agency report stats
 *     parameters:
 *       - $ref: "#/components/parameters/id"
 *     responses:
 *       200:
 *         description: Agency stats
 *       404:
 *         description: Agency not found
 */
router.get("/:id/stats", asyncHandler(getAgencyStatsController));

/**
 * @swagger
 * /api/agencies/{id}/reports:
 *   get:
 *     tags: [Agencies]
 *     summary: List agency reports
 *     parameters:
 *       - $ref: "#/components/parameters/id"
 *       - $ref: "#/components/parameters/page"
 *       - $ref: "#/components/parameters/limit"
 *       - $ref: "#/components/parameters/reportStatus"
 *     responses:
 *       200:
 *         description: Agency reports
 *       404:
 *         description: Agency not found
 */
router.get("/:id/reports", asyncHandler(listAgencyReportsController));

export default router;
