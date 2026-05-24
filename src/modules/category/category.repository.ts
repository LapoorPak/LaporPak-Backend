import { prisma } from "../../config/db.js";
import type { Prisma } from "../../generated/prisma/client.js";
import type { PaginationParams } from "../../utils/apiResponse.js";

export function findCategories(
  where: Prisma.KategoriLaporanWhereInput,
  pagination: PaginationParams,
) {
  return prisma.kategoriLaporan.findMany({
    where,
    include: { dinas: true },
    orderBy: { name: "asc" },
    skip: pagination.skip,
    take: pagination.take,
  });
}

export function countCategories(where: Prisma.KategoriLaporanWhereInput) {
  return prisma.kategoriLaporan.count({ where });
}

export function groupCategoriesByDinas(where: Prisma.KategoriLaporanWhereInput) {
  return prisma.kategoriLaporan.groupBy({
    by: ["dinasId"],
    where,
    _count: {
      _all: true,
    },
  });
}

export function findDinasSummariesByIds(ids: string[]) {
  return prisma.dinas.findMany({
    where: { id: { in: ids } },
    select: { id: true, code: true, name: true },
  });
}
