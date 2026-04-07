import { Router } from "express";

import { prisma } from "../config/db.js";
import { LaporanStatus } from "../generated/prisma/client.js";
import { AppError } from "../middleware/authMiddleware.js";
import { buildDataResponse, buildListResponse, parsePagination } from "../utils/apiResponse.js";

const router = Router();
const VALID_REPORT_STATUSES = Object.values(LaporanStatus);

function getStringQuery(value: unknown) {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : undefined;
  }

  return typeof value === "string" ? value : undefined;
}

async function getAgencyMapPins(params: { skip: number; take: number }) {
  const offices = await prisma.cabangDinas.findMany({
    where: {
      isRoutingEnabled: true,
      latitude: { not: null },
      longitude: { not: null },
      dinas: { isActive: true },
    },
    include: { dinas: true },
    orderBy: { name: "asc" },
    skip: params.skip,
    take: params.take,
  });

  return offices.map((office) => ({
    id: office.id,
    dinasId: office.dinasId,
    name: office.name,
    type: office.dinas.type || office.dinas.code,
    lat: office.latitude,
    lng: office.longitude,
    wilayah: office.wilayah,
    cityRegency: office.cityRegency,
    province: office.province,
    coverageRadiusKm: office.coverageRadiusKm,
    serviceTags: office.serviceTags,
  }));
}

// GET /api/agencies
router.get("/", async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query, { defaultLimit: 20 });

    if (req.query.view === "map" || req.query.format === "map") {
      const [pins, total, groupedByType] = await Promise.all([
        getAgencyMapPins({ skip: pagination.skip, take: pagination.take }),
        prisma.cabangDinas.count({
          where: {
            isRoutingEnabled: true,
            latitude: { not: null },
            longitude: { not: null },
            dinas: { isActive: true },
          },
        }),
        prisma.cabangDinas.groupBy({
          by: ["dinasId"],
          where: {
            isRoutingEnabled: true,
            latitude: { not: null },
            longitude: { not: null },
            dinas: { isActive: true },
          },
          _count: {
            _all: true,
          },
        }),
      ]);

      const dinasList = groupedByType.length
        ? await prisma.dinas.findMany({
            where: { id: { in: groupedByType.map((entry) => entry.dinasId) } },
            select: { id: true, code: true, type: true, name: true },
          })
        : [];
      const dinasMap = new Map(dinasList.map((dinas) => [dinas.id, dinas]));

      return res.json(
        buildListResponse(pins, pagination, total, {
          byType: groupedByType.map((entry) => ({
            dinasId: entry.dinasId,
            type: dinasMap.get(entry.dinasId)?.type || dinasMap.get(entry.dinasId)?.code || null,
            dinasName: dinasMap.get(entry.dinasId)?.name ?? null,
            total: entry._count?._all ?? 0,
          })),
        }),
      );
    }

    const search = getStringQuery(req.query.search);
    const type = getStringQuery(req.query.type);
    const where = {
      ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
      ...(type ? { type } : {}),
    };

    const [agencies, total, groupedByType] = await Promise.all([
      prisma.dinas.findMany({
        where,
        include: { kategori: true },
        orderBy: { name: "asc" },
        skip: pagination.skip,
        take: pagination.take,
      }),
      prisma.dinas.count({ where }),
      prisma.dinas.groupBy({
        by: ["type"],
        where,
        _count: {
          _all: true,
        },
      }),
    ]);

    res.json(
      buildListResponse(agencies, pagination, total, {
        byType: groupedByType.map((entry) => ({
          type: entry.type,
          total: entry._count?._all ?? 0,
        })),
      }),
    );
  } catch (error) {
    next(error);
  }
});

// GET /api/agencies/map-pins
router.get("/map-pins", async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query, { defaultLimit: 50, maxLimit: 200 });
    const [pins, total, groupedByType] = await Promise.all([
      getAgencyMapPins({ skip: pagination.skip, take: pagination.take }),
      prisma.cabangDinas.count({
        where: {
          isRoutingEnabled: true,
          latitude: { not: null },
          longitude: { not: null },
          dinas: { isActive: true },
        },
      }),
      prisma.cabangDinas.groupBy({
        by: ["dinasId"],
        where: {
          isRoutingEnabled: true,
          latitude: { not: null },
          longitude: { not: null },
          dinas: { isActive: true },
        },
        _count: {
          _all: true,
        },
      }),
    ]);

    const dinasList = groupedByType.length
      ? await prisma.dinas.findMany({
          where: { id: { in: groupedByType.map((entry) => entry.dinasId) } },
          select: { id: true, code: true, type: true, name: true },
        })
      : [];
    const dinasMap = new Map(dinasList.map((dinas) => [dinas.id, dinas]));

    res.json(
      buildListResponse(pins, pagination, total, {
        byType: groupedByType.map((entry) => ({
          dinasId: entry.dinasId,
          type: dinasMap.get(entry.dinasId)?.type || dinasMap.get(entry.dinasId)?.code || null,
          dinasName: dinasMap.get(entry.dinasId)?.name ?? null,
          total: entry._count?._all ?? 0,
        })),
      }),
    );
  } catch (error) {
    next(error);
  }
});

// GET /api/agencies/:id
router.get("/:id", async (req, res, next) => {
  try {
    const agency = await prisma.dinas.findUnique({
      where: { id: req.params.id },
      include: {
        kategori: true,
        cabang: {
          include: {
            petugas: {
              include: {
                user: { select: { id: true, name: true, image: true } },
              },
            },
          },
        },
      },
    });

    if (!agency) {
      throw new AppError("Agency not found", 404);
    }

    res.json(buildDataResponse(agency));
  } catch (error) {
    next(error);
  }
});

// GET /api/agencies/:id/stats
router.get("/:id/stats", async (req, res, next) => {
  try {
    const agency = await prisma.dinas.findUnique({
      where: { id: req.params.id },
    });

    if (!agency) {
      throw new AppError("Agency not found", 404);
    }

    const counts = await prisma.laporan.groupBy({
      by: ["status"],
      where: { kategori: { dinasId: req.params.id } },
      _count: true,
    });

    const stats = {
      pending: 0,
      verified: 0,
      in_progress: 0,
      resolved: 0,
      rejected: 0,
      total: 0,
    };

    for (const entry of counts) {
      stats[entry.status] = entry._count;
      stats.total += entry._count;
    }

    res.json(buildDataResponse(stats));
  } catch (error) {
    next(error);
  }
});

// GET /api/agencies/:id/reports
router.get("/:id/reports", async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query, { defaultLimit: 10, maxLimit: 100 });
    const status = getStringQuery(req.query.status);
    if (status && !VALID_REPORT_STATUSES.includes(status as (typeof VALID_REPORT_STATUSES)[number])) {
      throw new AppError(
        `Invalid status. Must be one of: ${VALID_REPORT_STATUSES.join(", ")}`,
        400,
      );
    }

    const where = {
      kategori: { dinasId: req.params.id },
      ...(status
        ? { status: status as (typeof VALID_REPORT_STATUSES)[number] }
        : {}),
    };

    const [laporan, total, groupedByStatus, groupedByCategory] = await Promise.all([
      prisma.laporan.findMany({
        where,
        include: {
          kategori: { include: { dinas: true } },
          createdBy: { select: { id: true, name: true, image: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: pagination.skip,
        take: pagination.take,
      }),
      prisma.laporan.count({ where }),
      prisma.laporan.groupBy({
        by: ["status"],
        where,
        _count: {
          _all: true,
        },
      }),
      prisma.laporan.groupBy({
        by: ["kategoriId"],
        where,
        _count: {
          _all: true,
        },
      }),
    ]);

    const categoryIds = groupedByCategory.map((entry) => entry.kategoriId);
    const categories = categoryIds.length
      ? await prisma.kategoriLaporan.findMany({
          where: { id: { in: categoryIds } },
          select: { id: true, code: true, name: true },
        })
      : [];
    const categoryMap = new Map(categories.map((category) => [category.id, category]));

    res.json(
      buildListResponse(laporan, pagination, total, {
        byStatus: groupedByStatus.map((entry) => ({
          status: entry.status,
          total: entry._count?._all ?? 0,
        })),
        byCategory: groupedByCategory.map((entry) => ({
          kategoriId: entry.kategoriId,
          kategoriCode: categoryMap.get(entry.kategoriId)?.code ?? null,
          kategoriName: categoryMap.get(entry.kategoriId)?.name ?? null,
          total: entry._count?._all ?? 0,
        })),
      }),
    );
  } catch (error) {
    next(error);
  }
});

export default router;
