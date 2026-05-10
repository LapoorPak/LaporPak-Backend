import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import crypto from "crypto";
import path from "path";
import { Readable } from "stream";

import { AppError } from "../middleware/authMiddleware.js";

const endpoint = process.env.S3_ENDPOINT_URL?.trim();
const region = process.env.S3_REGION?.trim() || "auto";
const bucket = process.env.S3_BUCKET_NAME?.trim();
const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim();
const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY?.trim();
const publicBaseUrl = process.env.S3_PUBLIC_BASE_URL?.trim();

const isConfigured = Boolean(endpoint && bucket && accessKeyId && secretAccessKey);

const publicBucketUrl =
  publicBaseUrl ||
  (endpoint && bucket
    ? `${new URL(endpoint).protocol}//${bucket}.${new URL(endpoint).host}`
    : "");

let client: S3Client | null = null;

function getClient() {
  if (!isConfigured || !endpoint || !accessKeyId || !secretAccessKey) {
    throw new AppError("S3 bucket configuration is incomplete", 500);
  }

  if (!client) {
    client = new S3Client({
      region,
      endpoint,
      forcePathStyle: false,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  return client;
}

function cleanSegment(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function getExtension(file: Express.Multer.File) {
  const originalExt = path.extname(file.originalname).replace(/^\./, "");
  if (originalExt) return cleanSegment(originalExt);

  const mimeExt = file.mimetype.split("/").pop();
  return mimeExt ? cleanSegment(mimeExt) : "bin";
}

function buildPublicUrl(key: string) {
  if (!publicBucketUrl) {
    throw new AppError("S3 public base URL is not configured", 500);
  }

  return `${publicBucketUrl.replace(/\/+$/, "")}/${key}`;
}

export async function uploadFileToBucket(file: Express.Multer.File, folder: string) {
  if (!file.buffer) {
    throw new AppError("Uploaded file buffer is missing", 500);
  }

  const fileStem = cleanSegment(path.basename(file.originalname, path.extname(file.originalname))) || "file";
  const key = `${cleanSegment(folder)}/${new Date().toISOString().slice(0, 10)}/${Date.now()}-${crypto.randomBytes(8).toString("hex")}-${fileStem}.${getExtension(file)}`;

  await getClient().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype || "application/octet-stream",
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );

  return buildPublicUrl(key);
}

export async function uploadFilesToBucket(files: unknown, folder: string) {
  if (!Array.isArray(files)) {
    return [];
  }

  return Promise.all(
    files
      .filter((file): file is Express.Multer.File => Boolean(file?.buffer))
      .map((file) => uploadFileToBucket(file, folder)),
  );
}

export function getObjectKeyFromPublicUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  if (!/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/^\/+/, "");
  }

  const parsedUrl = new URL(trimmed);
  return decodeURIComponent(parsedUrl.pathname.replace(/^\/+/, ""));
}

export async function getBucketObject(key: string) {
  const cleanKey = key.replace(/^\/+/, "");
  if (!cleanKey || cleanKey.includes("..")) {
    throw new AppError("Invalid object key", 400);
  }

  const result = await getClient().send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: cleanKey,
    }),
  );

  if (!result.Body) {
    throw new AppError("Object not found", 404);
  }

  const body = result.Body instanceof Readable
    ? result.Body
    : Readable.from(Buffer.from(await result.Body.transformToByteArray()));

  return {
    body,
    contentType: result.ContentType || "application/octet-stream",
    contentLength: result.ContentLength,
    cacheControl: result.CacheControl || "public, max-age=31536000, immutable",
  };
}
