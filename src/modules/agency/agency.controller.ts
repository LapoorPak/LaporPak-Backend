import type { Request, Response } from "express";
import {
  getAgencyById,
  getAgencyStats,
  listAgencies,
  listAgencyLocations,
  listAgencyReports,
  validateAgencyReportStatus,
} from "./agency.service.js";
import { buildDataResponse, buildListResponse, parsePagination } from "../../utils/apiResponse.js";
import { getStringQuery, getStringValue } from "../../utils/requestParsing.js";

export async function listAgenciesController(req: Request, res: Response) {
  const pagination = parsePagination(req.query, { defaultLimit: 20 });
  const payload = await listAgencies({
    pagination,
    search: getStringQuery(req.query.search),
    type: getStringQuery(req.query.type),
  });

  res.json(
    buildListResponse(payload.data, pagination, payload.total, payload.stats),
  );
}

export async function listAgencyLocationsController(req: Request, res: Response) {
  const payload = await listAgencyLocations({
    search: getStringQuery(req.query.search),
    type: getStringQuery(req.query.type),
    dinasId: getStringQuery(req.query.dinasId),
    cityRegency: getStringQuery(req.query.cityRegency),
    wilayah: getStringQuery(req.query.wilayah),
  });

  res.json(buildDataResponse(payload.data, { total: payload.total, ...payload.stats }));
}

export async function getAgencyByIdController(req: Request, res: Response) {
  const agency = await getAgencyById(getStringValue(req.params.id) ?? "");

  res.json(buildDataResponse(agency));
}

export async function getAgencyStatsController(req: Request, res: Response) {
  const stats = await getAgencyStats(getStringValue(req.params.id) ?? "");

  res.json(buildDataResponse(stats));
}

export async function listAgencyReportsController(req: Request, res: Response) {
  const pagination = parsePagination(req.query, { defaultLimit: 10, maxLimit: 100 });
  const payload = await listAgencyReports({
    agencyId: getStringValue(req.params.id) ?? "",
    pagination,
    status: validateAgencyReportStatus(getStringQuery(req.query.status)),
  });

  res.json(
    buildListResponse(payload.data, pagination, payload.total, payload.stats),
  );
}
