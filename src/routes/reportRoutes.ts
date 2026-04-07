import { Router } from "express";

import { prisma } from "../config/db.js";
import { AppError, requireAuth, requireAgencyRole, requireCitizenRole } from "../middleware/authMiddleware.js";
import { LaporanStatus, Prisma } from "../generated/prisma/client.js";
import { classifyReport, getDinasTypeForCategory } from "../services/geminiService.js";
import { notifyCabangOfficers, notifyUser, newReportNotification, officerStatusNotification, citizenStatusNotification } from "../services/notificationService.js";
import { resolveCabangDinas } from "../services/routingService.js";
import { buildDataResponse, buildListResponse, parsePagination } from "../utils/apiResponse.js";

const router = Router();
const VALID_STATUSES = Object.values(LaporanStatus);
const EARTH_RADIUS_KM = 6371;
type ResolvedKategori = Prisma.KategoriLaporanGetPayload<{ include: { dinas: true } }>;

function degreesToRadians(deg: number) {
  return deg * (Math.PI / 180);
}

function getStringQuery(value: unknown) {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : undefined;
  }

  return typeof value === "string" ? value : undefined;
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
  const dLat = degreesToRadians(lat2 - lat1);
  const dLng = degreesToRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(degreesToRadians(lat1)) * Math.cos(degreesToRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function computeUrgencyScore(baseWeight: number, confidence: number | null) {
  const safeWeight = Math.max(0, Math.min(100, baseWeight));
  const safeConfidence = Math.max(0, Math.min(1, confidence ?? 0.5));
  return Math.round(safeWeight * 0.75 + safeConfidence * 25);
}

function buildRoutingMeta(routing: Awaited<ReturnType<typeof resolveCabangDinas>>) {
  return {
    routingSource: routing.routingSource,
    wilayah: routing.wilayah,
    wilayahMatched: routing.wilayahMatched,
    distanceKm: routing.distanceKm,
    reasoning: routing.reasoning,
    candidateCabang: routing.candidateCabang,
  };
}

async function createRoutingDecision(input: {
  laporanId: string;
  kategoriId: string;
  dinasId: string | null;
  cabangDinasId: string | null;
  source: string;
  confidence: number | null;
  urgencyScore: number | null;
  suggestedSlaHours: number | null;
  distanceKm: number | null;
  wilayahMatched: string | null;
  reasoning: string | null;
  candidateCabang: unknown;
}) {
  await prisma.laporanRoutingDecision.create({
    data: {
      laporanId: input.laporanId,
      kategoriId: input.kategoriId,
      dinasId: input.dinasId,
      cabangDinasId: input.cabangDinasId,
      source: input.source,
      confidence: input.confidence,
      urgencyScore: input.urgencyScore,
      suggestedSlaHours: input.suggestedSlaHours,
      distanceKm: input.distanceKm,
      wilayahMatched: input.wilayahMatched,
      reasoning: input.reasoning,
      candidateCabang: input.candidateCabang as Prisma.InputJsonValue,
    },
  });
}

async function getReportStats(where: Prisma.LaporanWhereInput) {
  const [groupedByStatus, groupedByCategory] = await Promise.all([
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

  return {
    byStatus: groupedByStatus.map((entry) => ({
      status: entry.status,
      total: entry._count._all,
    })),
    byCategory: groupedByCategory.map((entry) => ({
      kategoriId: entry.kategoriId,
      kategoriCode: categoryMap.get(entry.kategoriId)?.code ?? null,
      kategoriName: categoryMap.get(entry.kategoriId)?.name ?? null,
      total: entry._count._all,
    })),
  };
}

function getInMemoryReportStats(
  laporan: Array<{
    status: string;
    kategoriId: string;
    kategori: { code: string; name: string };
  }>,
) {
  const byStatusMap = new Map<string, number>();
  const byCategoryMap = new Map<
    string,
    { kategoriId: string; kategoriCode: string; kategoriName: string; total: number }
  >();

  for (const item of laporan) {
    byStatusMap.set(item.status, (byStatusMap.get(item.status) ?? 0) + 1);

    const categoryEntry = byCategoryMap.get(item.kategoriId);
    if (categoryEntry) {
      categoryEntry.total += 1;
    } else {
      byCategoryMap.set(item.kategoriId, {
        kategoriId: item.kategoriId,
        kategoriCode: item.kategori.code,
        kategoriName: item.kategori.name,
        total: 1,
      });
    }
  }

  return {
    byStatus: Array.from(byStatusMap.entries()).map(([status, total]) => ({
      status,
      total,
    })),
    byCategory: Array.from(byCategoryMap.values()),
  };
}

// GET /api/reports
router.get("/", async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query, { defaultLimit: 10, maxLimit: 100 });
    const status = getStringQuery(req.query.status);
    const kategoriId = getStringQuery(req.query.kategoriId);
    const search = getStringQuery(req.query.search);
    if (status && !VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
      throw new AppError(`Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`, 400);
    }

    const where: Prisma.LaporanWhereInput = {};
    if (status) where.status = status as (typeof VALID_STATUSES)[number];
    if (kategoriId) where.kategoriId = kategoriId;
    if (search) where.title = { contains: search, mode: "insensitive" };

    const [laporan, total, stats] = await Promise.all([
      prisma.laporan.findMany({
        where,
        include: {
          kategori: { include: { dinas: true } },
          cabangDinas: { include: { dinas: true } },
          createdBy: { select: { id: true, name: true, image: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: pagination.skip,
        take: pagination.take,
      }),
      prisma.laporan.count({ where }),
      getReportStats(where),
    ]);

    res.json(buildListResponse(laporan, pagination, total, stats));
  } catch (error) {
    next(error);
  }
});

// GET /api/reports/me — MUST be before /:id
router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query, { defaultLimit: 10, maxLimit: 100 });
    const status = getStringQuery(req.query.status);
    const kategoriId = getStringQuery(req.query.kategoriId);
    const search = getStringQuery(req.query.search);
    if (status && !VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
      throw new AppError(`Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`, 400);
    }
    const where: Prisma.LaporanWhereInput = {
      createdById: req.user.id,
      ...(status ? { status: status as (typeof VALID_STATUSES)[number] } : {}),
      ...(kategoriId ? { kategoriId } : {}),
      ...(search ? { title: { contains: search, mode: "insensitive" } } : {}),
    };

    const [laporan, total, stats] = await Promise.all([
      prisma.laporan.findMany({
        where,
        include: {
          kategori: { include: { dinas: true } },
          cabangDinas: { include: { dinas: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: pagination.skip,
        take: pagination.take,
      }),
      prisma.laporan.count({ where }),
      getReportStats(where),
    ]);

    res.json(buildListResponse(laporan, pagination, total, stats));
  } catch (error) {
    next(error);
  }
});

// GET /api/reports/nearby
router.get("/nearby", async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query, { defaultLimit: 10, maxLimit: 100 });
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const radius = Number(req.query.radius) || 5;

    if (isNaN(lat) || isNaN(lng)) {
      throw new AppError("lat and lng query parameters are required", 400);
    }

    // Bounding box approximation
    const latDelta = radius / EARTH_RADIUS_KM * (180 / Math.PI);
    const lngDelta = latDelta / Math.cos(degreesToRadians(lat));

    const reports = await prisma.laporan.findMany({
      where: {
        latitude: { gte: lat - latDelta, lte: lat + latDelta },
        longitude: { gte: lng - lngDelta, lte: lng + lngDelta },
      },
      include: {
        kategori: { include: { dinas: true } },
        cabangDinas: { include: { dinas: true } },
        createdBy: { select: { id: true, name: true, image: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Post-filter with haversine for accuracy
    const nearbyReports = reports.filter(
      (r) => haversineDistance(lat, lng, r.latitude, r.longitude) <= radius,
    );

    const paginatedReports = nearbyReports.slice(
      pagination.skip,
      pagination.skip + pagination.take,
    );
    const stats = getInMemoryReportStats(
      nearbyReports.map((report) => ({
        status: report.status,
        kategoriId: report.kategoriId,
        kategori: {
          code: report.kategori.code,
          name: report.kategori.name,
        },
      })),
    );

    res.json(buildListResponse(paginatedReports, pagination, nearbyReports.length, stats));
  } catch (error) {
    next(error);
  }
});

// POST /api/reports/classify-preview
router.post("/classify-preview", requireAuth, async (req, res, next) => {
  try {
    const { title, description, images, latitude, longitude } = req.body;

    if (!title || !description) {
      throw new AppError("title and description are required", 400);
    }

    const result = await classifyReport({ title, description, imagePaths: images });

    const kategori = await prisma.kategoriLaporan.findUnique({
      where: { code: result.categoryCode },
      include: { dinas: true },
    });

    let routing = null;
    if (latitude != null && longitude != null) {
      const dinasType = kategori?.dinas?.type || getDinasTypeForCategory(result.categoryCode);
      if (dinasType) {
        routing = await resolveCabangDinas({
          dinasType,
          latitude: Number(latitude),
          longitude: Number(longitude),
        });
      }
    }

    res.json(
      buildDataResponse({
        ...result,
        kategori,
        assignedCabang: routing?.assignedCabang ?? null,
        routing,
      }),
    );
  } catch (error) {
    next(error);
  }
});

// POST /api/reports
router.post("/", requireAuth, requireCitizenRole, async (req, res, next) => {
  try {
    const { title, description, kategoriId, latitude, longitude, address, images } = req.body;

    if (!title || !description || latitude == null || longitude == null) {
      throw new AppError("title, description, latitude, and longitude are required", 400);
    }

    const latitudeValue = Number(latitude);
    const longitudeValue = Number(longitude);
    let resolvedKategori: ResolvedKategori | null = null;
    let dinasType: string | undefined;
    let aiConfidence: number | null = null;
    let aiReasoning: string | null = null;
    let aiClassified = false;

    if (kategoriId) {
      const kategori = await prisma.kategoriLaporan.findUnique({
        where: { id: kategoriId },
        include: { dinas: true },
      });

      if (!kategori) {
        throw new AppError("Invalid kategoriId", 400);
      }

      resolvedKategori = kategori;
      dinasType = kategori.dinas.type || kategori.dinas.code;
    } else {
      try {
        const result = await classifyReport({ title, description, imagePaths: images });

        const kategori = await prisma.kategoriLaporan.findUnique({
          where: { code: result.categoryCode },
          include: { dinas: true },
        });

        if (!kategori) {
          throw new Error("AI returned unknown category code");
        }

        resolvedKategori = kategori;
        dinasType = kategori.dinas.type || kategori.dinas.code || getDinasTypeForCategory(result.categoryCode);
        aiConfidence = result.confidence;
        aiReasoning = result.reasoning;
        aiClassified = true;
      } catch (e) {
        console.error("[classify] error:", e);
        throw new AppError(
          "Unable to classify report automatically. Please provide kategoriId manually.",
          422,
        );
      }
    }

    let routing = null;
    if (dinasType) {
      routing = await resolveCabangDinas({
        dinasType,
        latitude: latitudeValue,
        longitude: longitudeValue,
      });
    }

    const urgencyScore = computeUrgencyScore(
      resolvedKategori?.urgencyWeight ?? 50,
      aiConfidence,
    );
    const suggestedSlaHours = resolvedKategori?.slaHours ?? null;

    const laporan = await prisma.laporan.create({
      data: {
        title,
        description,
        kategoriId: resolvedKategori!.id,
        cabangDinasId: routing?.assignedCabang?.id ?? null,
        latitude: latitudeValue,
        longitude: longitudeValue,
        address: address || null,
        images: images || [],
        createdById: req.user.id,
        routingStatus: routing?.routingStatus ?? "manual_review",
        aiConfidence,
        aiReasoning,
        aiClassified,
        aiUrgencyScore: urgencyScore,
        aiSuggestedSlaHours: suggestedSlaHours,
        aiAssignedBranchReason: routing?.reasoning ?? aiReasoning,
        aiRouteMeta: routing
          ? (buildRoutingMeta(routing) as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
      include: {
        kategori: { include: { dinas: true } },
        cabangDinas: { include: { dinas: true } },
        createdBy: { select: { id: true, name: true, image: true } },
      },
    });

    await createRoutingDecision({
      laporanId: laporan.id,
      kategoriId: resolvedKategori!.id,
      dinasId: resolvedKategori?.dinasId ?? null,
      cabangDinasId: routing?.assignedCabang?.id ?? null,
      source: routing?.routingSource ?? (aiClassified ? "ai_without_branch" : "manual_category"),
      confidence: aiConfidence,
      urgencyScore,
      suggestedSlaHours,
      distanceKm: routing?.distanceKm ?? null,
      wilayahMatched: routing?.wilayahMatched ?? routing?.wilayah ?? null,
      reasoning: routing?.reasoning ?? aiReasoning,
      candidateCabang: routing?.candidateCabang ?? [],
    });

    if (routing?.assignedCabang?.id) {
      notifyCabangOfficers(
        routing.assignedCabang.id,
        newReportNotification(laporan.title, laporan.id, resolvedKategori!.name),
      ).catch((err) => console.error("[notification] failed to notify cabang officers:", err));
    }

    res.status(201).json(buildDataResponse(laporan));
  } catch (error) {
    next(error);
  }
});

// GET /api/reports/:id
router.get("/:id", async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const laporan = await prisma.laporan.findUnique({
      where: { id },
      include: {
        kategori: { include: { dinas: true } },
        cabangDinas: { include: { dinas: true } },
        createdBy: { select: { id: true, name: true, image: true } },
        assignedTo: { select: { id: true, name: true, image: true } },
      },
    });

    if (!laporan) {
      throw new AppError("Report not found", 404);
    }

    res.json(buildDataResponse(laporan));
  } catch (error) {
    next(error);
  }
});

// POST /api/reports/:id/status
router.post("/:id/status", requireAuth, requireAgencyRole, async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const { status, resolutionNote } = req.body;

    if (!status || !VALID_STATUSES.includes(status)) {
      throw new AppError(`Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`, 400);
    }

    const existing = await prisma.laporan.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new AppError("Report not found", 404);
    }

    const laporan = await prisma.laporan.update({
      where: { id },
      data: {
        status,
        resolvedAt: status === "resolved" ? new Date() : null,
        resolvedById: status === "resolved" ? req.user.id : null,
        resolutionNote: status === "resolved" ? String(resolutionNote || "") || null : null,
      },
      include: {
        kategori: { include: { dinas: true } },
        cabangDinas: { include: { dinas: true } },
        createdBy: { select: { id: true, name: true, image: true } },
        assignedTo: { select: { id: true, name: true, image: true } },
      },
    });

    // Notify the citizen who created the report
    const dinasName = laporan.kategori?.dinas?.name || "Dinas";
    notifyUser({
      ...citizenStatusNotification(status, laporan.title, laporan.id, dinasName),
      userId: laporan.createdById,
    }).catch((err) => console.error("[notification] citizen notify failed:", err));

    if (laporan.cabangDinas?.id) {
      notifyCabangOfficers(
        laporan.cabangDinas.id,
        officerStatusNotification(status, laporan.title, laporan.id, laporan.assignedTo?.name),
      ).catch((err) => console.error("[notification] cabang notify failed:", err));
    }

    res.json(buildDataResponse(laporan));
  } catch (error) {
    next(error);
  }
});

// POST /api/reports/:id/resolve
router.post("/:id/resolve", requireAuth, requireAgencyRole, async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const { resolutionNote } = req.body;

    const existing = await prisma.laporan.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new AppError("Report not found", 404);
    }

    const laporan = await prisma.laporan.update({
      where: { id },
      data: {
        status: "resolved",
        resolvedAt: new Date(),
        resolvedById: req.user.id,
        resolutionNote: String(resolutionNote || "") || null,
      },
      include: {
        kategori: { include: { dinas: true } },
        cabangDinas: { include: { dinas: true } },
        createdBy: { select: { id: true, name: true, image: true } },
        assignedTo: { select: { id: true, name: true, image: true } },
      },
    });

    const dinasName = laporan.kategori?.dinas?.name || "Dinas";
    notifyUser({
      ...citizenStatusNotification("resolved", laporan.title, laporan.id, dinasName),
      userId: laporan.createdById,
    }).catch((err) => console.error("[notification] citizen notify failed:", err));

    if (laporan.cabangDinas?.id) {
      notifyCabangOfficers(
        laporan.cabangDinas.id,
        officerStatusNotification("resolved", laporan.title, laporan.id, laporan.assignedTo?.name),
      ).catch((err) => console.error("[notification] cabang notify failed:", err));
    }

    res.json(buildDataResponse(laporan));
  } catch (error) {
    next(error);
  }
});

// POST /api/reports/:id/assign
router.post("/:id/assign", requireAuth, requireAgencyRole, async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const { assignedToId } = req.body;

    if (!assignedToId) {
      throw new AppError("assignedToId is required", 400);
    }

    const existing = await prisma.laporan.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new AppError("Report not found", 404);
    }

    const laporan = await prisma.laporan.update({
      where: { id },
      data: { assignedToId },
      include: {
        kategori: { include: { dinas: true } },
        cabangDinas: { include: { dinas: true } },
        createdBy: { select: { id: true, name: true, image: true } },
        assignedTo: { select: { id: true, name: true, image: true } },
      },
    });

    res.json(buildDataResponse(laporan));
  } catch (error) {
    next(error);
  }
});

export default router;
