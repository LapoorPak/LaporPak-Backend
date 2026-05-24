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
    prisma.dinas.count({ where: { stsrc: notDeleted } }),
    prisma.dinas.count({ where: { isActive: true, stsrc: notDeleted } }),
    prisma.cabangDinas.count({ where: { stsrc: notDeleted } }),
    prisma.cabangDinas.count({ where: { isRoutingEnabled: true, stsrc: notDeleted } }),
    prisma.kategoriLaporan.count({ where: { stsrc: notDeleted } }),
    prisma.kategoriLaporan.count({ where: { isActive: true, stsrc: notDeleted } }),
    prisma.user.count(),
    prisma.user.count({ where: { banned: true } }),
    prisma.petugasDinas.count(),
    prisma.laporan.count({ where: { stsrc: notDeleted } }),
    prisma.laporan.groupBy({ by: ["status"], where: { stsrc: notDeleted }, _count: { _all: true } }),
    prisma.laporan.groupBy({
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
  return prisma.kategoriLaporan.findMany({
    where: { id: { in: kategoriIds }, stsrc: notDeleted },
    select: { id: true, dinasId: true },
  });
}

export function findAdminOverviewDinasSummaries(dinasIds: string[]) {
  return prisma.dinas.findMany({
    where: { id: { in: dinasIds }, stsrc: notDeleted },
    select: { id: true, name: true, short: true },
  });
}
