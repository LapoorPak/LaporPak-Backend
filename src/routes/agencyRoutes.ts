import { Router } from "express";

import { prisma } from "../config/db.js";
import { AppError } from "../middleware/authMiddleware.js";

const router = Router();

// GET /api/agencies
router.get("/", async (_req, res, next) => {
  try {
    const agencies = await prisma.dinas.findMany({
      include: { kategori: true },
      orderBy: { name: "asc" },
    });

    res.json(agencies);
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

    res.json(agency);
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

    res.json(stats);
  } catch (error) {
    next(error);
  }
});

// GET /api/agencies/:id/reports
router.get("/:id/reports", async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
    const skip = (page - 1) * limit;
    const status = req.query.status as string | undefined;

    const where = {
      kategori: { dinasId: req.params.id },
      ...(status ? { status: status as any } : {}),
    };

    const [laporan, total] = await Promise.all([
      prisma.laporan.findMany({
        where,
        include: {
          kategori: { include: { dinas: true } },
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

export default router;
