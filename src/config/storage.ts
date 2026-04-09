import fs from "fs";
import path from "path";

function resolveUploadDir() {
  if (process.env.UPLOAD_DIR?.trim()) {
    return path.resolve(process.env.UPLOAD_DIR.trim());
  }

  if (process.env.RAILWAY_VOLUME_MOUNT_PATH?.trim()) {
    return path.resolve(process.env.RAILWAY_VOLUME_MOUNT_PATH.trim());
  }

  return path.resolve("uploads");
}

export const UPLOAD_DIR = resolveUploadDir();
export const UPLOAD_PUBLIC_PATH = "/uploads";
export const OFFICE_PHOTO_DIR = path.resolve("fotodinas");
export const OFFICE_PHOTO_PUBLIC_PATH = "/fotodinas";

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
