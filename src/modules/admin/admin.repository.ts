import { prisma } from "../../config/db.js";
import { Stsrc } from "../../generated/prisma/client.js";

const notDeleted = { not: Stsrc.D };

export async function getAdminOverviewSnapshot() {
  const [
    totalDinas,
    activeDinas,
    totalCabang,
    activeCabang,
    totalKategori,
    activeKategori,
    totalUsers,
    bannedUsers,
    totalPetugas,
    totalReports,
    statusCounts,
    topKategoriRaw,
  ] = await Promise.all([
    prisma.msDinas.count({ where: { stsrc: notDeleted } }),
    prisma.msDinas.count({ where: { isActive: true, stsrc: notDeleted } }),
    prisma.msCabangDinas.count({ where: { stsrc: notDeleted } }),
    prisma.msCabangDinas.count({ where: { isRoutingEnabled: true, stsrc: notDeleted } }),
    prisma.msKategoriLaporan.count({ where: { stsrc: notDeleted } }),
    prisma.msKategoriLaporan.count({ where: { isActive: true, stsrc: notDeleted } }),
    prisma.msUser.count(),
    prisma.msUser.count({ where: { banned: true } }),
    prisma.msPetugasDinas.count(),
    prisma.trLaporan.count({ where: { stsrc: notDeleted } }),
    prisma.trLaporan.groupBy({ by: ["status"], where: { stsrc: notDeleted }, _count: { _all: true } }),
    prisma.trLaporan.groupBy({
      by: ["kategoriId"],
      _count: { _all: true },
      where: { kategoriId: { not: null }, stsrc: notDeleted },
      orderBy: { _count: { kategoriId: "desc" } },
      take: 20,
    }),
  ]);

  return {
    totalDinas,
    activeDinas,
    totalCabang,
    activeCabang,
    totalKategori,
    activeKategori,
    totalUsers,
    bannedUsers,
    totalPetugas,
    totalReports,
    statusCounts,
    topKategoriRaw,
  };
}

export function findAdminOverviewKategoriMappings(kategoriIds: string[]) {
  return prisma.msKategoriLaporan.findMany({
    where: { id: { in: kategoriIds }, stsrc: notDeleted },
    select: { id: true, dinasId: true },
  });
}

export function findAdminOverviewDinasSummaries(dinasIds: string[]) {
  return prisma.msDinas.findMany({
    where: { id: { in: dinasIds }, stsrc: notDeleted },
    select: { id: true, name: true, short: true },
  });
}
