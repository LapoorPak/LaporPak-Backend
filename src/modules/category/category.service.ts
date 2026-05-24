import { Prisma, Stsrc } from "../../generated/prisma/client.js";
import {
  countCategories,
  findCategories,
  findDinasSummariesByIds,
  groupCategoriesByDinas,
} from "./category.repository.js";
import type { ListCategoriesInput } from "../../types/category.js";

export async function listCategories(input: ListCategoriesInput) {
  const where: Prisma.KategoriLaporanWhereInput = {
    stsrc: { not: Stsrc.D },
    dinas: { stsrc: { not: Stsrc.D } },
    ...(input.search ? { name: { contains: input.search, mode: "insensitive" } } : {}),
    ...(input.dinasId ? { dinasId: input.dinasId } : {}),
  };

  const [categories, total, groupedByDinas] = await Promise.all([
    findCategories(where, input.pagination),
    countCategories(where),
    groupCategoriesByDinas(where),
  ]);

  const dinasIds = groupedByDinas.map((entry) => entry.dinasId);
  const dinasList = dinasIds.length ? await findDinasSummariesByIds(dinasIds) : [];

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
