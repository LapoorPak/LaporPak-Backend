import multer from "multer";

import { AppError } from "../middleware/authMiddleware.js";
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      cb(new AppError("Only JPEG, PNG, and WebP images are allowed", 400));
      return;
    }
    cb(null, true);
  },
});
