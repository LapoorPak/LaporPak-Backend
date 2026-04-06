import { Router } from "express";

import { prisma } from "../config/db.js";
import { AppError, requireAuth, requireAgencyRole, requireCitizenRole } from "../middleware/authMiddleware.js";
import { LaporanStatus } from "../generated/prisma/client.js";
import { classifyReport, getDinasTypeForCategory } from "../services/geminiService.js";
import { getWilayah } from "../services/geoService.js";

const router = Router();
const VALID_STATUSES = Object.values(LaporanStatus);
const EARTH_RADIUS_KM = 6371;

function degreesToRadians(deg: number) {
  return deg * (Math.PI / 180);
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
  const dLat = degreesToRadians(lat2 - lat1);
  const dLng = degreesToRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(degreesToRadians(lat1)) * Math.cos(degreesToRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// GET /api/reports
router.get("/", async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
    const skip = (page - 1) * limit;
    const status = req.query.status as string | undefined;
    const kategoriId = req.query.kategoriId as string | undefined;
    const search = req.query.search as string | undefined;

    const where: any = {};
    if (status) where.status = status;
    if (kategoriId) where.kategoriId = kategoriId;
    if (search) where.title = { contains: search, mode: "insensitive" };

    const [laporan, total] = await Promise.all([
      prisma.laporan.findMany({
        where,
        include: {
          kategori: { include: { dinas: true } },
          cabangDinas: { include: { dinas: true } },
          createdBy: { select: { id: true, name: true, image: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.laporan.count({ where }),
    ]);

    res.json({
      laporan,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/reports/me — MUST be before /:id
router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
    const skip = (page - 1) * limit;

    const where = { createdById: req.user.id };

    const [laporan, total] = await Promise.all([
      prisma.laporan.findMany({
        where,
        include: {
          kategori: { include: { dinas: true } },
          cabangDinas: { include: { dinas: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.laporan.count({ where }),
    ]);

    res.json({
      laporan,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/reports/nearby
router.get("/nearby", async (req, res, next) => {
  try {
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
    const laporan = reports.filter(
      (r) => haversineDistance(lat, lng, r.latitude, r.longitude) <= radius,
    );

    res.json(laporan);
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

    // If coordinates provided, resolve the specific branch office by wilayah
    let assignedCabang = null;
    if (latitude != null && longitude != null) {
      const dinasType = getDinasTypeForCategory(result.categoryCode);
      const wilayah = getWilayah(Number(latitude), Number(longitude));
      if (dinasType && wilayah) {
        assignedCabang = await prisma.cabangDinas.findFirst({
          where: { dinas: { type: dinasType }, wilayah },
          include: { dinas: true },
        });
      }
    }

    res.json({ ...result, kategori, assignedCabang, wilayah: latitude != null && longitude != null ? getWilayah(Number(latitude), Number(longitude)) : null });
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

    let resolvedKategoriId: string;
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

      resolvedKategoriId = kategoriId;
      dinasType = kategori.dinas.type || kategori.dinas.code;
    } else {
      try {
        const result = await classifyReport({ title, description, imagePaths: images });

        const kategori = await prisma.kategoriLaporan.findUnique({
          where: { code: result.categoryCode },
        });

        if (!kategori) {
          throw new Error("AI returned unknown category code");
        }

        resolvedKategoriId = kategori.id;
        dinasType = getDinasTypeForCategory(result.categoryCode);
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

    // Resolve the specific branch office by dinas type + wilayah (geographic lookup)
    let cabangDinasId: string | null = null;
    if (dinasType) {
      const wilayah = getWilayah(Number(latitude), Number(longitude));
      if (wilayah) {
        const cabang = await prisma.cabangDinas.findFirst({
          where: { dinas: { type: dinasType }, wilayah },
        });
        if (cabang) cabangDinasId = cabang.id;
      }

      // Fallback: if no wilayah match, pick any branch of this dinas type
      if (!cabangDinasId) {
        const cabang = await prisma.cabangDinas.findFirst({
          where: { dinas: { type: dinasType } },
        });
        if (cabang) cabangDinasId = cabang.id;
      }
    }

    const laporan = await prisma.laporan.create({
      data: {
        title,
        description,
        kategoriId: resolvedKategoriId,
        cabangDinasId,
        latitude: Number(latitude),
        longitude: Number(longitude),
        address: address || null,
        images: images || [],
        createdById: req.user.id,
        aiConfidence,
        aiReasoning,
        aiClassified,
      },
      include: {
        kategori: { include: { dinas: true } },
        cabangDinas: { include: { dinas: true } },
        createdBy: { select: { id: true, name: true, image: true } },
      },
    });

    res.status(201).json(laporan);
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

    res.json(laporan);
  } catch (error) {
    next(error);
  }
});

// POST /api/reports/:id/status
router.post("/:id/status", requireAuth, requireAgencyRole, async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const { status } = req.body;

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
      data: { status },
      include: {
        kategori: { include: { dinas: true } },
        cabangDinas: { include: { dinas: true } },
        createdBy: { select: { id: true, name: true, image: true } },
        assignedTo: { select: { id: true, name: true, image: true } },
      },
    });

    res.json(laporan);
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

    res.json(laporan);
  } catch (error) {
    next(error);
  }
});

export default router;
