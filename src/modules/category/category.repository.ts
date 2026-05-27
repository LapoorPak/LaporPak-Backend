import { prisma } from "../../config/db.js";
import { Stsrc, type Prisma } from "../../generated/prisma/client.js";
import type { PaginationParams } from "../../utils/apiResponse.js";

const notDeleted = { not: Stsrc.D };

export function findCategories(
  where: Prisma.MsKategoriLaporanWhereInput,
  pagination: PaginationParams,
) {
  return prisma.msKategoriLaporan.findMany({
    where,
    include: { dinas: true },
    orderBy: { name: "asc" },
    skip: pagination.skip,
    take: pagination.take,
  });
}

export function countCategories(where: Prisma.MsKategoriLaporanWhereInput) {
  return prisma.msKategoriLaporan.count({ where });
}

export function groupCategoriesByDinas(where: Prisma.MsKategoriLaporanWhereInput) {
  return prisma.msKategoriLaporan.groupBy({
    by: ["dinasId"],
    where,
    _count: {
      _all: true,
    },
  });
}

export function findDinasSummariesByIds(ids: string[]) {
  return prisma.msDinas.findMany({
    where: { id: { in: ids }, stsrc: notDeleted },
    select: { id: true, code: true, name: true },
  });
}
