import type { Request, Response } from "express";

import { uploadFilesToBucket } from "../upload/bucket-storage.service.js";
import {
  createReport,
  getReportById,
  getReportDashboard,
  listMyReports,
  listReportLocations,
  listReports,
  rateReport,
  resolveReport,
  submitReportClarification,
  updateReportStatus,
  voteReport,
} from "./report.service.js";
import { buildDataResponse, buildListResponse, parsePagination } from "../../utils/apiResponse.js";
import {
  buildAiImageInputs,
  getBodyString,
  getNumberQuery,
  getStringArray,
  getStringQuery,
  getUploadedFiles,
} from "../../utils/requestParsing.js";

export async function listReportsController(req: Request, res: Response) {
  const pagination = parsePagination(req.query, { defaultLimit: 10, maxLimit: 100 });
  const payload = await listReports({
    pagination,
    status: getStringQuery(req.query.status),
    kategoriId: getStringQuery(req.query.kategoriId),
    search: getStringQuery(req.query.search),
  });

  res.json(buildListResponse(payload.data, pagination, payload.total, payload.stats));
}

export async function listMyReportsController(req: Request, res: Response) {
  const pagination = parsePagination(req.query, { defaultLimit: 10, maxLimit: 100 });
  const payload = await listMyReports({
    userId: req.user.id,
    pagination,
    status: getStringQuery(req.query.status),
    kategoriId: getStringQuery(req.query.kategoriId),
    search: getStringQuery(req.query.search),
  });

  res.json(buildListResponse(payload.data, pagination, payload.total, payload.stats));
}

export async function listReportLocationsController(req: Request, res: Response) {
  const hasPagination = req.query.page != null || req.query.limit != null || req.query.take != null;
  const pagination = hasPagination
    ? parsePagination(req.query, { defaultLimit: 5, maxLimit: 100 })
    : undefined;
  const payload = await listReportLocations({
    userId: req.user.id,
    role: req.user.role,
    pagination,
    scope: getStringQuery(req.query.scope) === "all"
      ? "all"
      : getStringQuery(req.query.scope) === "mine"
        ? "mine"
        : undefined,
    status: getStringQuery(req.query.status),
    kategoriId: getStringQuery(req.query.kategoriId),
    dinasId: getStringQuery(req.query.dinasId),
    cabangDinasId: getStringQuery(req.query.cabangDinasId),
    createdById: getStringQuery(req.query.createdById),
    search: getStringQuery(req.query.search),
    sort: getStringQuery(req.query.sort),
    minLat: getNumberQuery(req.query.minLat),
    maxLat: getNumberQuery(req.query.maxLat),
    minLng: getNumberQuery(req.query.minLng),
    maxLng: getNumberQuery(req.query.maxLng),
  });

  if (pagination) {
    res.json(buildListResponse(payload.data, pagination, payload.total, payload.stats));
    return;
  }

  res.json(buildDataResponse(payload.data, { total: payload.total, ...payload.stats }));
}

export async function getReportDashboardController(req: Request, res: Response) {
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
}

export async function createReportController(req: Request, res: Response) {
  const bodyImagePaths = getStringArray(req.body.images);
  const uploadedFiles = getUploadedFiles(req.files);
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
    aiImages: buildAiImageInputs(uploadedFiles, uploadedImagePaths),
  });

  res.status(201).json(buildDataResponse(report));
}

export async function getReportByIdController(req: Request, res: Response) {
  const laporan = await getReportById(String(req.params.id));
  res.json(buildDataResponse(laporan));
}

export async function updateReportStatusController(req: Request, res: Response) {
  const uploadedImagePaths = await uploadFilesToBucket(req.files, "report-updates");
  const bodyImagePaths = getStringArray(req.body.images);
  const laporan = await updateReportStatus({
    id: String(req.params.id),
    userId: req.user.id,
    status: getBodyString(req.body.status) ?? req.body.status,
    resolutionNote: req.body.resolutionNote,
    agencyNote: getBodyString(req.body.agencyNote) ?? getBodyString(req.body.catatanDinas),
    images: [...uploadedImagePaths, ...bodyImagePaths],
  });

  res.json(buildDataResponse(laporan));
}

export async function submitReportClarificationController(req: Request, res: Response) {
  const uploadedImagePaths = await uploadFilesToBucket(req.files, "clarification-images");
  const bodyImagePaths = getStringArray(req.body.images);
  const laporan = await submitReportClarification({
    id: String(req.params.id),
    userId: req.user.id,
    note: getBodyString(req.body.note) ?? getBodyString(req.body.clarificationNote),
    images: [...uploadedImagePaths, ...bodyImagePaths],
  });

  res.json(buildDataResponse(laporan));
}

export async function voteReportController(req: Request, res: Response) {
  const result = await voteReport({
    id: String(req.params.id),
    userId: req.user.id,
    vote: req.body.vote,
  });

  res.json(buildDataResponse(result));
}

export async function rateReportController(req: Request, res: Response) {
  const result = await rateReport({
    id: String(req.params.id),
    userId: req.user.id,
    score: req.body.score,
    note: req.body.note,
  });

  res.json(buildDataResponse(result));
}

export async function resolveReportController(req: Request, res: Response) {
  const uploadedResolutionImages = await uploadFilesToBucket(req.files, "resolution-images");
  const bodyResolutionImages = getStringArray(req.body.resolutionImages);
  const laporan = await resolveReport({
    id: String(req.params.id),
    userId: req.user.id,
    resolutionNote: req.body.resolutionNote,
    agencyNote: getBodyString(req.body.agencyNote) ?? getBodyString(req.body.catatanDinas),
    resolutionImages: [...uploadedResolutionImages, ...bodyResolutionImages],
  });

  res.json(buildDataResponse(laporan));
}
