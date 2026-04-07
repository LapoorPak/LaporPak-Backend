import { Router } from "express";

import { upload } from "../config/upload.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = Router();

// POST /api/upload/image
router.post("/image", requireAuth, upload.single("image"), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No image file provided" });
    return;
  }

  res.status(201).json({ url: `/uploads/${req.file.filename}` });
});

export default router;
