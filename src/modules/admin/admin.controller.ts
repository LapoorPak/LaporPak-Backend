import type { Request, Response } from "express";

import {
  adminAssignLaporan,
  adminDeleteLaporan,
  adminUpdateLaporanStatus,
  assignPetugasToUser,
  createCabang,
  createDinas,
  createKategori,
  deleteCabang,
  deleteDinas,
  deleteKategori,
  getAdminLaporanDetail,
  getAdminOverview,
  getAdminUserDetail,
  listAdminCabang,
  listAdminDinas,
  listAdminKategori,
  listAdminLaporan,
  listAdminUsers,
  removePetugasFromUser,
  resetAdminUserPassword,
  updateAdminUser,
  updateCabang,
  updateDinas,
  updateKategori,
} from "./admin.service.js";
import { buildDataResponse, buildListResponse, parsePagination } from "../../utils/apiResponse.js";
import {
  getBooleanQuery,
  getNumberValue,
  getStringQuery,
  getStringValue,
  parseStringArray,
} from "../../utils/requestParsing.js";

function getRouteId(req: Request) {
  return getStringValue(req.params.id) ?? "";
}

export async function getAdminOverviewController(_req: Request, res: Response) {
  const payload = await getAdminOverview();
  res.json(buildDataResponse(payload));
}

export async function listAdminDinasController(req: Request, res: Response) {
  const pagination = parsePagination(req.query, { defaultLimit: 20, maxLimit: 100 });
  const payload = await listAdminDinas({
    pagination,
    search: getStringQuery(req.query.search),
    isActive: getBooleanQuery(req.query.isActive),
  });

  res.json(buildListResponse(payload.data, pagination, payload.total));
}

export async function createDinasController(req: Request, res: Response) {
  const payload = await createDinas({
    code: getStringQuery(req.body.code) ?? "",
    type: getStringQuery(req.body.type),
    name: getStringQuery(req.body.name) ?? "",
    short: getStringQuery(req.body.short) ?? "",
    wilayah: getStringQuery(req.body.wilayah),
    description: getStringQuery(req.body.description),
    isActive: getBooleanQuery(req.body.isActive),
    routingPriority: getNumberValue(req.body.routingPriority),
  });

  res.status(201).json(buildDataResponse(payload));
}

export async function updateDinasController(req: Request, res: Response) {
  const payload = await updateDinas(getRouteId(req), {
    code: getStringQuery(req.body.code),
    type: getStringQuery(req.body.type),
    name: getStringQuery(req.body.name),
    short: getStringQuery(req.body.short),
    wilayah: getStringQuery(req.body.wilayah),
    description: getStringQuery(req.body.description),
    isActive: getBooleanQuery(req.body.isActive),
    routingPriority: getNumberValue(req.body.routingPriority),
  });

  res.json(buildDataResponse(payload));
}

export async function deleteDinasController(req: Request, res: Response) {
  const payload = await deleteDinas(getRouteId(req));
  res.json(buildDataResponse(payload));
}

export async function listAdminCabangController(req: Request, res: Response) {
  const pagination = parsePagination(req.query, { defaultLimit: 20, maxLimit: 100 });
  const payload = await listAdminCabang({
    pagination,
    search: getStringQuery(req.query.search),
    dinasId: getStringQuery(req.query.dinasId),
    wilayah: getStringQuery(req.query.wilayah),
    cityRegency: getStringQuery(req.query.cityRegency),
    isRoutingEnabled: getBooleanQuery(req.query.isRoutingEnabled),
  });

  res.json(buildListResponse(payload.data, pagination, payload.total));
}

export async function createCabangController(req: Request, res: Response) {
  const payload = await createCabang({
    dinasId: getStringQuery(req.body.dinasId) ?? "",
    name: getStringQuery(req.body.name) ?? "",
    wilayah: getStringQuery(req.body.wilayah) ?? "",
    address: getStringQuery(req.body.address),
    latitude: getNumberValue(req.body.latitude),
    longitude: getNumberValue(req.body.longitude),
    phone: getStringQuery(req.body.phone),
    province: getStringQuery(req.body.province),
    cityRegency: getStringQuery(req.body.cityRegency),
    coverageRadiusKm: getNumberValue(req.body.coverageRadiusKm),
    isRoutingEnabled: getBooleanQuery(req.body.isRoutingEnabled),
    serviceTags: parseStringArray(req.body.serviceTags),
    photos: parseStringArray(req.body.photos),
    metadata: typeof req.body.metadata === "object" ? req.body.metadata : undefined,
  });

  res.status(201).json(buildDataResponse(payload));
}

export async function updateCabangController(req: Request, res: Response) {
  const payload = await updateCabang(getRouteId(req), {
    name: getStringQuery(req.body.name),
    wilayah: getStringQuery(req.body.wilayah),
    address: getStringQuery(req.body.address),
    latitude: getNumberValue(req.body.latitude),
    longitude: getNumberValue(req.body.longitude),
    phone: getStringQuery(req.body.phone),
    province: getStringQuery(req.body.province),
    cityRegency: getStringQuery(req.body.cityRegency),
    coverageRadiusKm: getNumberValue(req.body.coverageRadiusKm),
    isRoutingEnabled: getBooleanQuery(req.body.isRoutingEnabled),
    serviceTags: parseStringArray(req.body.serviceTags),
    photos: parseStringArray(req.body.photos),
    metadata: typeof req.body.metadata === "object" ? req.body.metadata : undefined,
  });

  res.json(buildDataResponse(payload));
}

export async function deleteCabangController(req: Request, res: Response) {
  const payload = await deleteCabang(getRouteId(req));
  res.json(buildDataResponse(payload));
}

export async function listAdminKategoriController(req: Request, res: Response) {
  const pagination = parsePagination(req.query, { defaultLimit: 20, maxLimit: 100 });
  const payload = await listAdminKategori({
    pagination,
    search: getStringQuery(req.query.search),
    dinasId: getStringQuery(req.query.dinasId),
    isActive: getBooleanQuery(req.query.isActive),
  });

  res.json(buildListResponse(payload.data, pagination, payload.total));
}

export async function createKategoriController(req: Request, res: Response) {
  const payload = await createKategori({
    code: getStringQuery(req.body.code) ?? "",
    name: getStringQuery(req.body.name) ?? "",
    description: getStringQuery(req.body.description),
    slaHours: getNumberValue(req.body.slaHours),
    urgencyWeight: getNumberValue(req.body.urgencyWeight),
    keywords: parseStringArray(req.body.keywords),
    isActive: getBooleanQuery(req.body.isActive),
    dinasId: getStringQuery(req.body.dinasId) ?? "",
  });

  res.status(201).json(buildDataResponse(payload));
}

export async function updateKategoriController(req: Request, res: Response) {
  const payload = await updateKategori(getRouteId(req), {
    code: getStringQuery(req.body.code),
    name: getStringQuery(req.body.name),
    description: getStringQuery(req.body.description),
    slaHours: getNumberValue(req.body.slaHours),
    urgencyWeight: getNumberValue(req.body.urgencyWeight),
    keywords: parseStringArray(req.body.keywords),
    isActive: getBooleanQuery(req.body.isActive),
    dinasId: getStringQuery(req.body.dinasId),
  });

  res.json(buildDataResponse(payload));
}

export async function deleteKategoriController(req: Request, res: Response) {
  const payload = await deleteKategori(getRouteId(req));
  res.json(buildDataResponse(payload));
}

export async function listAdminUsersController(req: Request, res: Response) {
  const pagination = parsePagination(req.query, { defaultLimit: 20, maxLimit: 100 });
  const payload = await listAdminUsers({
    pagination,
    search: getStringQuery(req.query.search),
    role: getStringQuery(req.query.role),
    banned: getBooleanQuery(req.query.banned),
    hasPetugas: getBooleanQuery(req.query.hasPetugas),
  });

  res.json(buildListResponse(payload.data, pagination, payload.total));
}

export async function getAdminUserDetailController(req: Request, res: Response) {
  const payload = await getAdminUserDetail(getRouteId(req));
  res.json(buildDataResponse(payload));
}

export async function updateAdminUserController(req: Request, res: Response) {
  const payload = await updateAdminUser(getRouteId(req), {
    name: getStringQuery(req.body.name),
    email: getStringQuery(req.body.email),
    phone: getStringQuery(req.body.phone),
    role: getStringQuery(req.body.role),
    banned: getBooleanQuery(req.body.banned),
    banReason: getStringQuery(req.body.banReason),
    banExpires: req.body.banExpires ? new Date(req.body.banExpires) : undefined,
  });

  res.json(buildDataResponse(payload));
}

export async function resetAdminUserPasswordController(req: Request, res: Response) {
  const payload = await resetAdminUserPassword({
    userId: getRouteId(req),
    newPassword: getStringQuery(req.body.newPassword) ?? "",
  });

  res.json(buildDataResponse(payload));
}

export async function assignPetugasToUserController(req: Request, res: Response) {
  const payload = await assignPetugasToUser({
    userId: getRouteId(req),
    cabangDinasId: getStringQuery(req.body.cabangDinasId) ?? "",
    nip: getStringQuery(req.body.nip),
  });

  res.json(buildDataResponse(payload));
}

export async function removePetugasFromUserController(req: Request, res: Response) {
  const payload = await removePetugasFromUser(getRouteId(req));
  res.json(buildDataResponse(payload));
}

export async function listAdminLaporanController(req: Request, res: Response) {
  const pagination = parsePagination(req.query, { defaultLimit: 20, maxLimit: 100 });
  const payload = await listAdminLaporan({
    pagination,
    search: getStringQuery(req.query.search),
    status: getStringQuery(req.query.status),
    dinasId: getStringQuery(req.query.dinasId),
    cabangDinasId: getStringQuery(req.query.cabangDinasId),
    kategoriId: getStringQuery(req.query.kategoriId),
  });

  res.json(buildListResponse(payload.data, pagination, payload.total));
}

export async function getAdminLaporanDetailController(req: Request, res: Response) {
  const payload = await getAdminLaporanDetail(getRouteId(req));
  res.json(buildDataResponse(payload));
}

export async function updateAdminLaporanStatusController(req: Request, res: Response) {
  const payload = await adminUpdateLaporanStatus({
    id: getRouteId(req),
    status: getStringQuery(req.body.status) ?? "",
    agencyNote: getStringQuery(req.body.agencyNote),
    resolutionNote: getStringQuery(req.body.resolutionNote),
    adminUserId: req.user.id,
  });

  res.json(buildDataResponse(payload));
}

export async function assignAdminLaporanController(req: Request, res: Response) {
  const payload = await adminAssignLaporan(
    getRouteId(req),
    getStringQuery(req.body.cabangDinasId) ?? "",
  );

  res.json(buildDataResponse(payload));
}

export async function deleteAdminLaporanController(req: Request, res: Response) {
  const payload = await adminDeleteLaporan(getRouteId(req));
  res.json(buildDataResponse(payload));
}
