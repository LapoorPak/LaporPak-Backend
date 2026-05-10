import { Router } from "express";

import { upload } from "../config/upload.js";
import { requireAuth, requireAgencyRole, requireCitizenRole } from "../middleware/authMiddleware.js";
import { uploadFilesToBucket } from "../services/bucketStorageService.js";
import {
  createReport,
  getReportById,
  getReportDashboard,
  listMyReports,
  listReportLocations,
  listReports,
  resolveReport,
  updateReportStatus,
} from "../services/reportService.js";
import { buildDataResponse, buildListResponse, parsePagination } from "../utils/apiResponse.js";

const router = Router();

function getStringQuery(value: unknown) {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : undefined;
  }

  return typeof value === "string" ? value : undefined;
}

function getNumberQuery(value: unknown) {
  const parsed = Number(getStringQuery(value));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function getBodyString(value: unknown) {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : undefined;
  }

  return typeof value === "string" ? value : undefined;
}

function getBodyStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  if (typeof value !== "string") {
    return [];
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }

  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === "string")
        : [];
    } catch {
      return [trimmed];
    }
  }

  return [trimmed];
}

function getMulterFiles(files: unknown) {
  return Array.isArray(files)
    ? files.filter((file): file is Express.Multer.File => Boolean(file?.buffer))
    : [];
}

function buildAiImages(files: Express.Multer.File[], paths: string[]) {
  return files.map((file, index) => ({
    path: paths[index],
    buffer: file.buffer,
    mimeType: file.mimetype,
    size: file.size,
  })).filter((item) => Boolean(item.path));
}

// GET /api/reports
router.get("/", async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query, { defaultLimit: 10, maxLimit: 100 });
    const payload = await listReports({
      pagination,
      status: getStringQuery(req.query.status),
      kategoriId: getStringQuery(req.query.kategoriId),
      search: getStringQuery(req.query.search),
    });

    res.json(buildListResponse(payload.data, pagination, payload.total, payload.stats));
  } catch (error) {
    next(error);
  }
});

// GET /api/reports/me — MUST be before /:id
router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query, { defaultLimit: 10, maxLimit: 100 });
    const payload = await listMyReports({
      userId: req.user.id,
      pagination,
      status: getStringQuery(req.query.status),
      kategoriId: getStringQuery(req.query.kategoriId),
      search: getStringQuery(req.query.search),
    });

    res.json(buildListResponse(payload.data, pagination, payload.total, payload.stats));
  } catch (error) {
    next(error);
  }
});

// GET /api/reports/locations
router.get("/locations", requireAuth, async (req, res, next) => {
  try {
    const payload = await listReportLocations({
      userId: req.user.id,
      role: req.user.role,
      scope: getStringQuery(req.query.scope) === "all" ? "all" : getStringQuery(req.query.scope) === "mine" ? "mine" : undefined,
      status: getStringQuery(req.query.status),
      kategoriId: getStringQuery(req.query.kategoriId),
      dinasId: getStringQuery(req.query.dinasId),
      cabangDinasId: getStringQuery(req.query.cabangDinasId),
      createdById: getStringQuery(req.query.createdById),
      minLat: getNumberQuery(req.query.minLat),
      maxLat: getNumberQuery(req.query.maxLat),
      minLng: getNumberQuery(req.query.minLng),
      maxLng: getNumberQuery(req.query.maxLng),
    });

    res.json(buildDataResponse(payload.data, { total: payload.total, ...payload.stats }));
  } catch (error) {
    next(error);
  }
});

// GET /api/reports/dashboard
router.get("/dashboard", requireAuth, requireAgencyRole, async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query, { defaultLimit: 10, maxLimit: 100 });
    const payload = await getReportDashboard({
      pagination,
      userId: req.user.id,
      role: req.user.role,
      scope: getStringQuery(req.query.scope) === "all" ? "all" : "mine",
      tab: getStringQuery(req.query.tab),
      requestedDinasId: getStringQuery(req.query.dinasId),
      requestedCabangDinasId: getStringQuery(req.query.cabangDinasId),
      search: getStringQuery(req.query.search),
      kategoriId: getStringQuery(req.query.kategoriId),
    });

    res.json(buildListResponse(payload.data, pagination, payload.total, payload.stats));
  } catch (error) {
    next(error);
  }
});

// POST /api/reports
router.post("/", requireAuth, requireCitizenRole, upload.array("images", 5), async (req, res, next) => {
  try {
    const bodyImagePaths = getBodyStringArray(req.body.images);
    const uploadedFiles = getMulterFiles(req.files);
    const uploadedImagePaths = await uploadFilesToBucket(uploadedFiles, "report-images");
    const report = await createReport({
      createdById: req.user.id,
      title: getBodyString(req.body.title),
      description: getBodyString(req.body.description),
      kategoriId: getBodyString(req.body.kategoriId),
      address: getBodyString(req.body.address),
      latitude: getBodyString(req.body.latitude) ?? req.body.latitude,
      longitude: getBodyString(req.body.longitude) ?? req.body.longitude,
      imagePaths: [...uploadedImagePaths, ...bodyImagePaths],
      aiImages: buildAiImages(uploadedFiles, uploadedImagePaths),
    });

    res.status(201).json(buildDataResponse(report));
  } catch (error) {
    next(error);
  }
});

// GET /api/reports/:id
router.get("/:id", async (req, res, next) => {
  try {
    const laporan = await getReportById(String(req.params.id));

    res.json(buildDataResponse(laporan));
  } catch (error) {
    next(error);
  }
});

// POST /api/reports/:id/status
router.post("/:id/status", requireAuth, requireAgencyRole, upload.array("images", 5), async (req, res, next) => {
  try {
    const uploadedImagePaths = await uploadFilesToBucket(req.files, "report-updates");
    const bodyImagePaths = getBodyStringArray(req.body.images);
    const laporan = await updateReportStatus({
      id: String(req.params.id),
      userId: req.user.id,
      status: getBodyString(req.body.status) ?? req.body.status,
      resolutionNote: req.body.resolutionNote,
      agencyNote: getBodyString(req.body.agencyNote) ?? getBodyString(req.body.catatanDinas),
      images: [...uploadedImagePaths, ...bodyImagePaths],
    });

    res.json(buildDataResponse(laporan));
  } catch (error) {
    next(error);
  }
});

// POST /api/reports/:id/resolve
router.post("/:id/resolve", requireAuth, requireAgencyRole, upload.array("resolutionImages", 5), async (req, res, next) => {
  try {
    const uploadedResolutionImages = await uploadFilesToBucket(req.files, "resolution-images");
    const bodyResolutionImages = getBodyStringArray(req.body.resolutionImages);
    const laporan = await resolveReport({
      id: String(req.params.id),
      userId: req.user.id,
      resolutionNote: req.body.resolutionNote,
      agencyNote: getBodyString(req.body.agencyNote) ?? getBodyString(req.body.catatanDinas),
      resolutionImages: [...uploadedResolutionImages, ...bodyResolutionImages],
    });

    res.json(buildDataResponse(laporan));
  } catch (error) {
    next(error);
  }
});

export default router;
