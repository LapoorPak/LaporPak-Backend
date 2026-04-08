import { prisma } from "../config/db.js";
import { Prisma } from "../generated/prisma/client.js";
import type { ListCategoriesInput } from "../types/category.js";

export async function listCategories(input: ListCategoriesInput) {
  const where: Prisma.KategoriLaporanWhereInput = {
    ...(input.search ? { name: { contains: input.search, mode: "insensitive" } } : {}),
    ...(input.dinasId ? { dinasId: input.dinasId } : {}),
  };

  const [categories, total, groupedByDinas] = await Promise.all([
    prisma.kategoriLaporan.findMany({
      where,
      include: { dinas: true },
      orderBy: { name: "asc" },
      skip: input.pagination.skip,
      take: input.pagination.take,
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

  return {
    data: categories,
    total,
    stats: {
      byDinas: groupedByDinas.map((entry) => ({
        dinasId: entry.dinasId,
        dinasCode: dinasMap.get(entry.dinasId)?.code ?? null,
        dinasName: dinasMap.get(entry.dinasId)?.name ?? null,
        total: entry._count?._all ?? 0,
      })),
    },
  };
}
