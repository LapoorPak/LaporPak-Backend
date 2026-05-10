import { Router } from "express";

import { upload } from "../config/upload.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { getBucketObject, getObjectKeyFromPublicUrl, uploadFileToBucket } from "../services/bucketStorageService.js";
import { buildDataResponse } from "../utils/apiResponse.js";

const router = Router();

// POST /api/upload/image
router.post("/image", requireAuth, upload.single("image"), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No image file provided" });
      return;
    }

    const url = await uploadFileToBucket(req.file, "agency-photos");
    res.status(201).json(buildDataResponse({ url }));
  } catch (error) {
    next(error);
  }
});

// GET /api/upload/object/:key
router.get("/object/*splat", async (req, res, next) => {
  try {
    const splat = req.params.splat;
    const key = Array.isArray(splat) ? splat.join("/") : String(splat ?? "");
    const object = await getBucketObject(getObjectKeyFromPublicUrl(key));

    res.setHeader("Content-Type", object.contentType);
    res.setHeader("Cache-Control", object.cacheControl);
    if (object.contentLength != null) {
      res.setHeader("Content-Length", object.contentLength.toString());
    }

    object.body.pipe(res);
  } catch (error) {
    next(error);
  }
});

export default router;
