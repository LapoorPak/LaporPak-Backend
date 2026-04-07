import { Router } from "express";

import { UPLOAD_PUBLIC_PATH } from "../config/storage.js";
import { upload } from "../config/upload.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = Router();

// POST /api/upload/image
router.post("/image", requireAuth, upload.single("image"), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No image file provided" });
    return;
  }

  res.status(201).json({ url: `${UPLOAD_PUBLIC_PATH}/${req.file.filename}` });
});

export default router;
