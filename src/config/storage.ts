import fs from "fs";
import path from "path";

export const OFFICE_PHOTO_DIR = path.resolve("fotodinas");
export const OFFICE_PHOTO_PUBLIC_PATH = "/fotodinas";
fs.mkdirSync(OFFICE_PHOTO_DIR, { recursive: true });
