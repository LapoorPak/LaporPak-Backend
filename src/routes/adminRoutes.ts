import { Router } from "express";

import { requireAdminRole, requireAuth } from "../middleware/authMiddleware.js";
import {
  assignPetugasToUser,
  createCabang,
  createDinas,
  createKategori,
  deleteCabang,
  deleteDinas,
  deleteKategori,
  getAdminOverview,
  getAdminUserDetail,
  listAdminCabang,
  listAdminDinas,
  listAdminKategori,
  listAdminUsers,
  removePetugasFromUser,
  resetAdminUserPassword,
  updateAdminUser,
  updateCabang,
  updateDinas,
  updateKategori,
} from "../services/adminService.js";
import { buildDataResponse, buildListResponse, parsePagination } from "../utils/apiResponse.js";

const router = Router();

function getStringQuery(value: unknown) {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : undefined;
  }

  return typeof value === "string" ? value : undefined;
}

function getBooleanQuery(value: unknown) {
  const parsed = getStringQuery(value);
  if (parsed === undefined) return undefined;
  if (parsed === "true") return true;
  if (parsed === "false") return false;
  return undefined;
}

function getNumberValue(value: unknown) {
  if (value == null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return [];

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

router.use(requireAuth, requireAdminRole);

// GET /api/admin/overview
router.get("/overview", async (_req, res, next) => {
  try {
    const payload = await getAdminOverview();
    res.json(buildDataResponse(payload));
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/dinas
router.get("/dinas", async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query, { defaultLimit: 20, maxLimit: 100 });
    const payload = await listAdminDinas({
      pagination,
      search: getStringQuery(req.query.search),
      isActive: getBooleanQuery(req.query.isActive),
    });
    res.json(buildListResponse(payload.data, pagination, payload.total));
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/dinas
router.post("/dinas", async (req, res, next) => {
  try {
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
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/dinas/:id
router.patch("/dinas/:id", async (req, res, next) => {
  try {
    const payload = await updateDinas(req.params.id, {
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
  } catch (error) {
    next(error);
  }
});

// DELETE /api/admin/dinas/:id
router.delete("/dinas/:id", async (req, res, next) => {
  try {
    const payload = await deleteDinas(req.params.id);
    res.json(buildDataResponse(payload));
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/cabang
router.get("/cabang", async (req, res, next) => {
  try {
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
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/cabang
router.post("/cabang", async (req, res, next) => {
  try {
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
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/cabang/:id
router.patch("/cabang/:id", async (req, res, next) => {
  try {
    const payload = await updateCabang(req.params.id, {
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
  } catch (error) {
    next(error);
  }
});

// DELETE /api/admin/cabang/:id
router.delete("/cabang/:id", async (req, res, next) => {
  try {
    const payload = await deleteCabang(req.params.id);
    res.json(buildDataResponse(payload));
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/kategori
router.get("/kategori", async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query, { defaultLimit: 20, maxLimit: 100 });
    const payload = await listAdminKategori({
      pagination,
      search: getStringQuery(req.query.search),
      dinasId: getStringQuery(req.query.dinasId),
      isActive: getBooleanQuery(req.query.isActive),
    });
    res.json(buildListResponse(payload.data, pagination, payload.total));
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/kategori
router.post("/kategori", async (req, res, next) => {
  try {
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
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/kategori/:id
router.patch("/kategori/:id", async (req, res, next) => {
  try {
    const payload = await updateKategori(req.params.id, {
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
  } catch (error) {
    next(error);
  }
});

// DELETE /api/admin/kategori/:id
router.delete("/kategori/:id", async (req, res, next) => {
  try {
    const payload = await deleteKategori(req.params.id);
    res.json(buildDataResponse(payload));
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/users
router.get("/users", async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query, { defaultLimit: 20, maxLimit: 100 });
    const payload = await listAdminUsers({
      pagination,
      search: getStringQuery(req.query.search),
      role: getStringQuery(req.query.role),
      banned: getBooleanQuery(req.query.banned),
      hasPetugas: getBooleanQuery(req.query.hasPetugas),
    });
    res.json(buildListResponse(payload.data, pagination, payload.total));
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/users/:id
router.get("/users/:id", async (req, res, next) => {
  try {
    const payload = await getAdminUserDetail(req.params.id);
    res.json(buildDataResponse(payload));
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/users/:id
router.patch("/users/:id", async (req, res, next) => {
  try {
    const payload = await updateAdminUser(req.params.id, {
      name: getStringQuery(req.body.name),
      email: getStringQuery(req.body.email),
      phone: getStringQuery(req.body.phone),
      role: getStringQuery(req.body.role),
      banned: getBooleanQuery(req.body.banned),
      banReason: getStringQuery(req.body.banReason),
      banExpires: req.body.banExpires ? new Date(req.body.banExpires) : undefined,
    });
    res.json(buildDataResponse(payload));
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/users/:id/reset-password
router.post("/users/:id/reset-password", async (req, res, next) => {
  try {
    const payload = await resetAdminUserPassword({
      userId: req.params.id,
      newPassword: getStringQuery(req.body.newPassword) ?? "",
    });
    res.json(buildDataResponse(payload));
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/users/:id/assign-petugas
router.post("/users/:id/assign-petugas", async (req, res, next) => {
  try {
    const payload = await assignPetugasToUser({
      userId: req.params.id,
      cabangDinasId: getStringQuery(req.body.cabangDinasId) ?? "",
      nip: getStringQuery(req.body.nip),
    });
    res.json(buildDataResponse(payload));
  } catch (error) {
    next(error);
  }
});

// DELETE /api/admin/users/:id/assign-petugas
router.delete("/users/:id/assign-petugas", async (req, res, next) => {
  try {
    const payload = await removePetugasFromUser(req.params.id);
    res.json(buildDataResponse(payload));
  } catch (error) {
    next(error);
  }
});

export default router;

