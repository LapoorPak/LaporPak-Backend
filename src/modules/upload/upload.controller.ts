import type { Request, Response } from "express";

import { getBucketObject, getObjectKeyFromPublicUrl, uploadFileToBucket } from "./bucket-storage.service.js";
import { buildDataResponse } from "../../utils/apiResponse.js";

export async function uploadImageController(req: Request, res: Response) {
  if (!req.file) {
    res.status(400).json({ error: "No image file provided" });
    return;
  }

  const url = await uploadFileToBucket(req.file, "agency-photos");
  res.status(201).json(buildDataResponse({ url }));
}

export async function streamBucketObjectController(req: Request, res: Response) {
  const splat = req.params.splat;
  const key = Array.isArray(splat) ? splat.join("/") : String(splat ?? "");
  const object = await getBucketObject(getObjectKeyFromPublicUrl(key));

  res.setHeader("Content-Type", object.contentType);
  res.setHeader("Cache-Control", object.cacheControl);
  if (object.contentLength != null) {
    res.setHeader("Content-Length", object.contentLength.toString());
  }

  object.body.pipe(res);
}
