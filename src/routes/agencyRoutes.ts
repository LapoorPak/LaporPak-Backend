import { Router } from "express";

import {
  getAgencyById,
  getAgencyStats,
  listAgencies,
  listAgencyLocations,
  listAgencyReports,
  validateAgencyReportStatus,
} from "../services/agencyService.js";
import { buildDataResponse, buildListResponse, parsePagination } from "../utils/apiResponse.js";

const router = Router();

function getStringQuery(value: unknown) {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : undefined;
  }

  return typeof value === "string" ? value : undefined;
}

// GET /api/agencies
router.get("/", async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query, { defaultLimit: 20 });
    const payload = await listAgencies({
      pagination,
      search: getStringQuery(req.query.search),
      type: getStringQuery(req.query.type),
    });

    res.json(
      buildListResponse(payload.data, pagination, payload.total, payload.stats),
    );
  } catch (error) {
    next(error);
  }
});

// GET /api/agencies/locations
router.get("/locations", async (req, res, next) => {
  try {
    const payload = await listAgencyLocations({
      search: getStringQuery(req.query.search),
      type: getStringQuery(req.query.type),
      dinasId: getStringQuery(req.query.dinasId),
      cityRegency: getStringQuery(req.query.cityRegency),
      wilayah: getStringQuery(req.query.wilayah),
    });

    res.json(buildDataResponse(payload.data, { total: payload.total, ...payload.stats }));
  } catch (error) {
    next(error);
  }
});

// GET /api/agencies/:id
router.get("/:id", async (req, res, next) => {
  try {
    const agency = await getAgencyById(req.params.id);

    res.json(buildDataResponse(agency));
  } catch (error) {
    next(error);
  }
});

// GET /api/agencies/:id/stats
router.get("/:id/stats", async (req, res, next) => {
  try {
    const stats = await getAgencyStats(req.params.id);

    res.json(buildDataResponse(stats));
  } catch (error) {
    next(error);
  }
});

// GET /api/agencies/:id/reports
router.get("/:id/reports", async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query, { defaultLimit: 10, maxLimit: 100 });
    const payload = await listAgencyReports({
      agencyId: req.params.id,
      pagination,
      status: validateAgencyReportStatus(getStringQuery(req.query.status)),
    });

    res.json(
      buildListResponse(payload.data, pagination, payload.total, payload.stats),
    );
  } catch (error) {
    next(error);
  }
});

export default router;
