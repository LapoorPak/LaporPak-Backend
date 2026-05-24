import { prisma } from "../../config/db.js";

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
    prisma.dinas.count(),
    prisma.dinas.count({ where: { isActive: true } }),
    prisma.cabangDinas.count(),
    prisma.cabangDinas.count({ where: { isRoutingEnabled: true } }),
    prisma.kategoriLaporan.count(),
    prisma.kategoriLaporan.count({ where: { isActive: true } }),
    prisma.user.count(),
    prisma.user.count({ where: { banned: true } }),
    prisma.petugasDinas.count(),
    prisma.laporan.count(),
    prisma.laporan.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.laporan.groupBy({
      by: ["kategoriId"],
      _count: { _all: true },
      where: { kategoriId: { not: null } },
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
  return prisma.kategoriLaporan.findMany({
    where: { id: { in: kategoriIds } },
    select: { id: true, dinasId: true },
  });
}

export function findAdminOverviewDinasSummaries(dinasIds: string[]) {
  return prisma.dinas.findMany({
    where: { id: { in: dinasIds } },
    select: { id: true, name: true, short: true },
  });
}
