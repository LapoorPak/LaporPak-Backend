import {
  findAdminOverviewDinasSummaries,
  findAdminOverviewKategoriMappings,
  getAdminOverviewSnapshot,
} from "./admin.repository.js";

export {
  createCabang,
  createDinas,
  createKategori,
  deleteCabang,
  deleteDinas,
  deleteKategori,
  listAdminCabang,
  listAdminDinas,
  listAdminKategori,
  getAdminCabangActivity,
  getAdminDinasActivity,
  getAdminKategoriActivity,
  updateCabang,
  updateDinas,
  updateKategori,
} from "./admin-master-data.service.js";
export {
  adminAssignLaporan,
  adminDeleteLaporan,
  adminUpdateLaporanStatus,
  getAdminReportActivity,
  getAdminLaporanDetail,
  listAdminLaporan,
} from "./admin-report.service.js";
export {
  assignPetugasToUser,
  getAdminUserActivity,
  getAdminUserDetail,
  listAdminUsers,
  removePetugasFromUser,
  resetAdminUserPassword,
  updateAdminUser,
} from "./admin-user.service.js";

export async function getAdminOverview() {
  const {
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
  } = await getAdminOverviewSnapshot();

  const byStatus: Record<string, number> = {};
  for (const row of statusCounts) {
    byStatus[row.status] = row._count._all;
  }

  const kategoriIds = topKategoriRaw.map((r) => r.kategoriId).filter(Boolean) as string[];
  const kategoriList = kategoriIds.length > 0
    ? await findAdminOverviewKategoriMappings(kategoriIds)
    : [];

  const kategoriToDinas = new Map(kategoriList.map((k) => [k.id, k.dinasId]));
  const dinasCounts: Record<string, number> = {};
  for (const row of topKategoriRaw) {
    if (row.kategoriId) {
      const dinasId = kategoriToDinas.get(row.kategoriId);
      if (dinasId) {
        dinasCounts[dinasId] = (dinasCounts[dinasId] ?? 0) + row._count._all;
      }
    }
  }

  const topDinasEntries = Object.entries(dinasCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);
  const topDinasIds = topDinasEntries.map(([id]) => id);

  const dinasMap = topDinasIds.length > 0
    ? Object.fromEntries(
        (await findAdminOverviewDinasSummaries(topDinasIds)).map((d) => [d.id, d]),
      )
    : {};

  const topDinas = topDinasEntries
    .filter(([dinasId]) => dinasMap[dinasId])
    .map(([dinasId, count]) => ({
      name: dinasMap[dinasId].name,
      short: dinasMap[dinasId].short ?? undefined,
      count,
    }));

  return {
    dinas: totalDinas,
    dinasActive: activeDinas,
    cabang: totalCabang,
    cabangActive: activeCabang,
    kategori: totalKategori,
    kategoriActive: activeKategori,
    users: {
      total: totalUsers,
      banned: bannedUsers,
      active: totalUsers - bannedUsers,
    },
    petugas: totalPetugas,
    reports: {
      total: totalReports,
      byStatus,
    },
    topDinas,
  };
}
