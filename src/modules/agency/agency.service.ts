import { LaporanStatus, Prisma, Stsrc } from "../../generated/prisma/client.js";
import { AppError } from "../../middleware/authMiddleware.js";
import {
  countAgencies,
  countAgencyLocations,
  countAgencyReports,
  findAgencies,
  findAgencyById,
  findAgencyId,
  findAgencyLocations,
  findAgencyReports,
  findAgencySummariesByIds,
  findCategorySummariesByIds,
  groupAgenciesByType,
  groupAgencyLocationsByCityRegency,
  groupAgencyLocationsByDinas,
  groupAgencyReportsByCategory,
  groupAgencyReportsByReportStatus,
  groupAgencyReportsByStatus,
} from "./agency.repository.js";
import type {
  AgencyLocationFilters,
  ListAgenciesInput,
  ListAgencyReportsInput,
} from "../../types/agency.js";

const VALID_REPORT_STATUSES = Object.values(LaporanStatus);

function buildAgencyLocationWhere(input: AgencyLocationFilters): Prisma.CabangDinasWhereInput {
  const filters: Prisma.CabangDinasWhereInput[] = [
    {
      isRoutingEnabled: true,
      stsrc: { not: Stsrc.D },
      latitude: { not: null },
      longitude: { not: null },
      dinas: {
        isActive: true,
        stsrc: { not: Stsrc.D },
        ...(input.type ? { type: input.type } : {}),
        ...(input.dinasId ? { id: input.dinasId } : {}),
      },
    },
  ];

  if (input.cityRegency) {
    filters.push({
      cityRegency: {
        contains: input.cityRegency,
        mode: "insensitive",
      },
    });
  }

  if (input.wilayah) {
    filters.push({
      wilayah: {
        contains: input.wilayah,
        mode: "insensitive",
      },
    });
  }

  if (input.search) {
    filters.push({
      OR: [
        { name: { contains: input.search, mode: "insensitive" } },
        { address: { contains: input.search, mode: "insensitive" } },
        { wilayah: { contains: input.search, mode: "insensitive" } },
        { cityRegency: { contains: input.search, mode: "insensitive" } },
        { province: { contains: input.search, mode: "insensitive" } },
        { dinas: { name: { contains: input.search, mode: "insensitive" } } },
        { dinas: { short: { contains: input.search, mode: "insensitive" } } },
        { dinas: { code: { contains: input.search, mode: "insensitive" } } },
        { dinas: { type: { contains: input.search, mode: "insensitive" } } },
      ],
    });
  }

  return filters.length === 1 ? filters[0] : { AND: filters };
}

async function getAgencyLocationStats(where: Prisma.CabangDinasWhereInput) {
  const [groupedByDinas, groupedByCityRegency] = await Promise.all([
    groupAgencyLocationsByDinas(where),
    groupAgencyLocationsByCityRegency(where),
  ]);

  const dinasList = groupedByDinas.length
    ? await findAgencySummariesByIds(groupedByDinas.map((entry) => entry.dinasId))
    : [];
  const dinasMap = new Map(dinasList.map((dinas) => [dinas.id, dinas]));

  return {
    byType: groupedByDinas.map((entry) => ({
      dinasId: entry.dinasId,
      type: dinasMap.get(entry.dinasId)?.type || dinasMap.get(entry.dinasId)?.code || null,
      dinasName: dinasMap.get(entry.dinasId)?.name ?? null,
      total: entry._count?._all ?? 0,
    })),
    byCityRegency: groupedByCityRegency.map((entry) => ({
      cityRegency: entry.cityRegency,
      total: entry._count?._all ?? 0,
    })),
  };
}

export function validateAgencyReportStatus(status?: string) {
  if (!status) {
    return undefined;
  }

  if (!VALID_REPORT_STATUSES.includes(status as LaporanStatus)) {
    throw new AppError(
      `Invalid status. Must be one of: ${VALID_REPORT_STATUSES.join(", ")}`,
      400,
    );
  }

  return status as LaporanStatus;
}

export async function listAgencies(input: ListAgenciesInput) {
  const where: Prisma.DinasWhereInput = {
    stsrc: { not: Stsrc.D },
    ...(input.search ? { name: { contains: input.search, mode: "insensitive" } } : {}),
    ...(input.type ? { type: input.type } : {}),
  };

  const [agencies, total, groupedByType] = await Promise.all([
    findAgencies(where, input.pagination),
    countAgencies(where),
    groupAgenciesByType(where),
  ]);

  return {
    data: agencies,
    total,
    stats: {
      byType: groupedByType.map((entry) => ({
        type: entry.type,
        total: entry._count?._all ?? 0,
      })),
    },
  };
}

export async function listAgencyLocations(filters: AgencyLocationFilters) {
  const where = buildAgencyLocationWhere(filters);
  const [offices, total, stats] = await Promise.all([
    findAgencyLocations(where),
    countAgencyLocations(where),
    getAgencyLocationStats(where),
  ]);

  return {
    data: offices.map((office) => ({
      id: office.id,
      dinasId: office.dinas.id,
      dinasCode: office.dinas.code,
      dinasName: office.dinas.name,
      dinasShort: office.dinas.short,
      type: office.dinas.type || office.dinas.code,
      name: office.name,
      lat: office.latitude,
      lng: office.longitude,
      wilayah: office.wilayah,
      address: office.address,
      phone: office.phone,
      cityRegency: office.cityRegency,
      province: office.province,
      coverageRadiusKm: office.coverageRadiusKm,
      isRoutingEnabled: office.isRoutingEnabled,
      serviceTags: office.serviceTags,
      photos: office.photos,
      photoUrl: office.photos[0] ?? null,
    })),
    total,
    stats,
  };
}

export async function getAgencyById(id: string) {
  const agency = await findAgencyById(id);

  if (!agency) {
    throw new AppError("Agency not found", 404);
  }

  return agency;
}

export async function getAgencyStats(id: string) {
  const agency = await findAgencyId(id);

  if (!agency) {
    throw new AppError("Agency not found", 404);
  }

  const counts = await groupAgencyReportsByStatus(id);

  const stats = {
    pending: 0,
    verified: 0,
    in_progress: 0,
    clarification_requested: 0,
    resolved: 0,
    rejected: 0,
    total: 0,
  };

  for (const entry of counts) {
    stats[entry.status] = entry._count;
    stats.total += entry._count;
  }

  return stats;
}

export async function listAgencyReports(input: ListAgencyReportsInput) {
  const where: Prisma.LaporanWhereInput = {
    stsrc: { not: Stsrc.D },
    kategori: { dinasId: input.agencyId },
    ...(input.status ? { status: input.status } : {}),
  };

  const [laporan, total, groupedByStatus, groupedByCategory] = await Promise.all([
    findAgencyReports(where, input.pagination),
    countAgencyReports(where),
    groupAgencyReportsByReportStatus(where),
    groupAgencyReportsByCategory(where),
  ]);

  const categoryIds = groupedByCategory
    .map((entry) => entry.kategoriId)
    .filter((value): value is string => typeof value === "string");
  const categories = categoryIds.length
    ? await findCategorySummariesByIds(categoryIds)
    : [];
  const categoryMap = new Map(categories.map((category) => [category.id, category]));

  return {
    data: laporan,
    total,
    stats: {
      byStatus: groupedByStatus.map((entry) => ({
        status: entry.status,
        total: entry._count?._all ?? 0,
      })),
      byCategory: groupedByCategory.map((entry) => ({
        kategoriId: entry.kategoriId,
        kategoriCode: entry.kategoriId ? categoryMap.get(entry.kategoriId)?.code ?? null : null,
        kategoriName: entry.kategoriId ? categoryMap.get(entry.kategoriId)?.name ?? null : null,
        total: entry._count?._all ?? 0,
      })),
    },
  };
}
