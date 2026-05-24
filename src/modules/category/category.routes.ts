import { Router } from "express";

import { listCategoriesController } from "./category.controller.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const router = Router();

/**
 * @swagger
 * /api/categories:
 *   get:
 *     tags: [Categories]
 *     summary: List report categories
 *     parameters:
 *       - $ref: "#/components/parameters/page"
 *       - $ref: "#/components/parameters/limit"
 *       - $ref: "#/components/parameters/search"
 *       - $ref: "#/components/parameters/dinasId"
 *     responses:
 *       200:
 *         description: Category list
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiListResponse"
 */
router.get("/", asyncHandler(listCategoriesController));

export default router;
