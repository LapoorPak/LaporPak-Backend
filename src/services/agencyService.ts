import { prisma } from "../config/db.js";
import { LaporanStatus, Prisma } from "../generated/prisma/client.js";
import { AppError } from "../middleware/authMiddleware.js";
import type {
  AgencyLocationFilters,
  ListAgenciesInput,
  ListAgencyReportsInput,
} from "../types/agency.js";

const VALID_REPORT_STATUSES = Object.values(LaporanStatus);

function buildAgencyLocationWhere(input: AgencyLocationFilters): Prisma.CabangDinasWhereInput {
  const filters: Prisma.CabangDinasWhereInput[] = [
    {
      isRoutingEnabled: true,
      latitude: { not: null },
      longitude: { not: null },
      dinas: {
        isActive: true,
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
    prisma.cabangDinas.groupBy({
      by: ["dinasId"],
      where,
      _count: {
        _all: true,
      },
    }),
    prisma.cabangDinas.groupBy({
      by: ["cityRegency"],
      where,
      _count: {
        _all: true,
      },
    }),
  ]);

  const dinasList = groupedByDinas.length
    ? await prisma.dinas.findMany({
        where: { id: { in: groupedByDinas.map((entry) => entry.dinasId) } },
        select: { id: true, code: true, type: true, name: true },
      })
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
    ...(input.search ? { name: { contains: input.search, mode: "insensitive" } } : {}),
    ...(input.type ? { type: input.type } : {}),
  };

  const [agencies, total, groupedByType] = await Promise.all([
    prisma.dinas.findMany({
      where,
      include: { kategori: true },
      orderBy: { name: "asc" },
      skip: input.pagination.skip,
      take: input.pagination.take,
    }),
    prisma.dinas.count({ where }),
    prisma.dinas.groupBy({
      by: ["type"],
      where,
      _count: {
        _all: true,
      },
    }),
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
    prisma.cabangDinas.findMany({
      where,
      select: {
        id: true,
        name: true,
        wilayah: true,
        address: true,
        latitude: true,
        longitude: true,
        phone: true,
        province: true,
        cityRegency: true,
        coverageRadiusKm: true,
        isRoutingEnabled: true,
        serviceTags: true,
        photos: true,
        metadata: true,
        dinas: {
          select: {
            id: true,
            code: true,
            type: true,
            name: true,
            short: true,
          },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.cabangDinas.count({ where }),
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
  const agency = await prisma.dinas.findUnique({
    where: { id },
    include: {
      kategori: true,
      cabang: {
        include: {
          petugas: {
            include: {
              user: { select: { id: true, name: true, image: true } },
            },
          },
        },
      },
    },
  });

  if (!agency) {
    throw new AppError("Agency not found", 404);
  }

  return agency;
}

export async function getAgencyStats(id: string) {
  const agency = await prisma.dinas.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!agency) {
    throw new AppError("Agency not found", 404);
  }

  const counts = await prisma.laporan.groupBy({
    by: ["status"],
    where: { kategori: { dinasId: id } },
    _count: true,
  });

  const stats = {
    pending: 0,
    verified: 0,
    in_progress: 0,
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
    kategori: { dinasId: input.agencyId },
    ...(input.status ? { status: input.status } : {}),
  };

  const [laporan, total, groupedByStatus, groupedByCategory] = await Promise.all([
    prisma.laporan.findMany({
      where,
      include: {
        kategori: { include: { dinas: true } },
        createdBy: { select: { id: true, name: true, image: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: input.pagination.skip,
      take: input.pagination.take,
    }),
    prisma.laporan.count({ where }),
    prisma.laporan.groupBy({
      by: ["status"],
      where,
      _count: {
        _all: true,
      },
    }),
    prisma.laporan.groupBy({
      by: ["kategoriId"],
      where,
      _count: {
        _all: true,
      },
    }),
  ]);

  const categoryIds = groupedByCategory
    .map((entry) => entry.kategoriId)
    .filter((value): value is string => typeof value === "string");
  const categories = categoryIds.length
    ? await prisma.kategoriLaporan.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true, code: true, name: true },
      })
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
