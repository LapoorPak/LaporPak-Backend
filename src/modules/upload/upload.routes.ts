import { Router } from "express";

import { upload } from "../../config/upload.js";
import { requireAuth } from "../../middleware/authMiddleware.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import {
  streamBucketObjectController,
  uploadImageController,
} from "./upload.controller.js";

const router = Router();

/**
 * @swagger
 * /api/upload/image:
 *   post:
 *     tags: [Upload]
 *     summary: Upload image
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: "#/components/schemas/UploadImageMultipart"
 *     responses:
 *       201:
 *         description: Image uploaded
 *       400:
 *         description: No image file provided
 *       401:
 *         description: Unauthorized
 */
router.post("/image", requireAuth, upload.single("image"), asyncHandler(uploadImageController));

/**
 * @swagger
 * /api/upload/object/{key}:
 *   get:
 *     tags: [Upload]
 *     summary: Stream uploaded object
 *     parameters:
 *       - name: key
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Object key or nested object path
 *     responses:
 *       200:
 *         description: Object stream
 *       400:
 *         description: Invalid object key
 *       404:
 *         description: Object not found
 */
router.get("/object/*splat", asyncHandler(streamBucketObjectController));

export default router;
