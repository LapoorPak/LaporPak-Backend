import { Router } from "express";

import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../config/db.js";
import { buildListResponse, parsePagination } from "../utils/apiResponse.js";

const router = Router();

function getStringQuery(value: unknown) {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : undefined;
  }

  return typeof value === "string" ? value : undefined;
}

// GET /api/categories
router.get("/", async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query, { defaultLimit: 20 });
    const search = getStringQuery(req.query.search);
    const dinasId = getStringQuery(req.query.dinasId);

    const where: Prisma.KategoriLaporanWhereInput = {
      ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
      ...(dinasId ? { dinasId } : {}),
    };

    const [categories, total, groupedByDinas] = await Promise.all([
      prisma.kategoriLaporan.findMany({
        where,
        include: { dinas: true },
        orderBy: { name: "asc" },
        skip: pagination.skip,
        take: pagination.take,
      }),
      prisma.kategoriLaporan.count({ where }),
      prisma.kategoriLaporan.groupBy({
        by: ["dinasId"],
        where,
        _count: {
          _all: true,
        },
      }),
    ]);

    const dinasIds = groupedByDinas.map((entry) => entry.dinasId);
    const dinasList = dinasIds.length
      ? await prisma.dinas.findMany({
          where: { id: { in: dinasIds } },
          select: { id: true, code: true, name: true },
        })
      : [];

    const dinasMap = new Map(dinasList.map((dinas) => [dinas.id, dinas]));
    const byDinas = groupedByDinas.map((entry) => ({
      dinasId: entry.dinasId,
      dinasCode: dinasMap.get(entry.dinasId)?.code ?? null,
      dinasName: dinasMap.get(entry.dinasId)?.name ?? null,
      total: entry._count?._all ?? 0,
    }));

    res.json(
      buildListResponse(categories, pagination, total, {
        byDinas,
      }),
    );
  } catch (error) {
    next(error);
  }
});

export default router;
