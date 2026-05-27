import { prisma } from "../../config/db.js";
import { LaporanStatus, Prisma, Stsrc } from "../../generated/prisma/client.js";
import { AppError } from "../../middleware/authMiddleware.js";
import type {
  ListAdminCabangInput,
  ListAdminDinasInput,
  ListAdminKategoriInput,
  SortDirection,
} from "../../types/admin.js";

const NONE_FILTER_VALUE = "__none";

function getSortDirection(direction?: SortDirection) {
  return direction === "asc" ? "asc" : "desc";
}

function getAdminDinasOrderBy(input: ListAdminDinasInput): Prisma.MsDinasOrderByWithRelationInput {
  const direction = getSortDirection(input.sortDir);

  switch (input.sortBy) {
    case "code":
    case "type":
    case "short":
    case "isActive":
    case "routingPriority":
    case "createdAt":
    case "updatedAt":
      return { [input.sortBy]: direction };
    case "cabang":
      return { cabang: { _count: direction } };
    case "kategori":
      return { kategori: { _count: direction } };
    case "name":
    default:
      return { name: input.sortBy ? direction : "asc" };
  }
}

function getAdminCabangOrderBy(input: ListAdminCabangInput): Prisma.MsCabangDinasOrderByWithRelationInput {
  const direction = getSortDirection(input.sortDir);

  switch (input.sortBy) {
    case "wilayah":
    case "cityRegency":
    case "isRoutingEnabled":
    case "createdAt":
    case "updatedAt":
      return { [input.sortBy]: direction };
    case "petugas":
      return { petugas: { _count: direction } };
    case "laporan":
      return { laporan: { _count: direction } };
    case "dinas":
      return { dinas: { name: direction } };
    case "name":
    default:
      return { name: input.sortBy ? direction : "asc" };
  }
}

function getAdminKategoriOrderBy(input: ListAdminKategoriInput): Prisma.MsKategoriLaporanOrderByWithRelationInput {
  const direction = getSortDirection(input.sortDir);

  switch (input.sortBy) {
    case "code":
    case "slaHours":
    case "urgencyWeight":
    case "isActive":
    case "createdAt":
    case "updatedAt":
      return { [input.sortBy]: direction };
    case "laporan":
      return { laporan: { _count: direction } };
    case "dinas":
      return { dinas: { name: direction } };
    case "name":
    default:
      return { name: input.sortBy ? direction : "asc" };
  }
}

function getAdminDinasWhere(input: ListAdminDinasInput) {
  return {
    stsrc: { not: Stsrc.D },
    ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
    ...(input.search
      ? {
          OR: [
            { name: { contains: input.search, mode: "insensitive" as const } },
            { short: { contains: input.search, mode: "insensitive" as const } },
            { code: { contains: input.search, mode: "insensitive" as const } },
            { type: { contains: input.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  } satisfies Prisma.MsDinasWhereInput;
}

function getAdminKategoriWhere(input: ListAdminKategoriInput) {
  const dinasIds = input.dinasIds?.length
    ? input.dinasIds
    : input.dinasId
      ? [input.dinasId]
      : [];

  return {
    stsrc: { not: Stsrc.D },
    ...(dinasIds.includes(NONE_FILTER_VALUE)
      ? { id: NONE_FILTER_VALUE }
      : dinasIds.length > 0
        ? { dinasId: { in: dinasIds } }
        : {}),
    ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
    ...(input.search
      ? {
          OR: [
            { name: { contains: input.search, mode: "insensitive" as const } },
            { code: { contains: input.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  } satisfies Prisma.MsKategoriLaporanWhereInput;
}

function getAdminCabangWhere(input: ListAdminCabangInput) {
  const dinasIds = input.dinasIds?.length
    ? input.dinasIds
    : input.dinasId
      ? [input.dinasId]
      : [];

  return {
    stsrc: { not: Stsrc.D },
    ...(dinasIds.includes(NONE_FILTER_VALUE)
      ? { id: NONE_FILTER_VALUE }
      : dinasIds.length > 0
        ? { dinasId: { in: dinasIds } }
        : {}),
    ...(input.isRoutingEnabled === undefined
      ? {}
      : { isRoutingEnabled: input.isRoutingEnabled }),
    ...(input.wilayah
      ? { wilayah: { contains: input.wilayah, mode: "insensitive" as const } }
      : {}),
    ...(input.cityRegency
      ? { cityRegency: { contains: input.cityRegency, mode: "insensitive" as const } }
      : {}),
    ...(input.search
      ? {
          OR: [
            { name: { contains: input.search, mode: "insensitive" as const } },
            { address: { contains: input.search, mode: "insensitive" as const } },
            { cityRegency: { contains: input.search, mode: "insensitive" as const } },
            { province: { contains: input.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  } satisfies Prisma.MsCabangDinasWhereInput;
}

function getDayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getDayLabel(date: Date) {
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
  });
}

export async function listAdminDinas(input: ListAdminDinasInput) {
  const where = getAdminDinasWhere(input);

  const [data, total] = await Promise.all([
    prisma.msDinas.findMany({
      where,
      orderBy: getAdminDinasOrderBy(input),
      skip: input.pagination.skip,
      take: input.pagination.take,
      include: {
        _count: {
          select: {
            kategori: true,
            cabang: true,
          },
        },
      },
    }),
    prisma.msDinas.count({ where }),
  ]);

  return {
    data,
    total,
  };
}

export async function getAdminDinasActivity(input: Omit<ListAdminDinasInput, "pagination">) {
  const where = getAdminDinasWhere({
    ...input,
    pagination: { page: 1, limit: 1, skip: 0, take: 1 },
  });
  const dinas = await prisma.msDinas.findMany({
    where,
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: {
          cabang: true,
          kategori: true,
        },
      },
    },
  });
  const dinasIds = dinas.map((item) => item.id);
  const [categories, branches] =
    dinasIds.length > 0
      ? await Promise.all([
          prisma.msKategoriLaporan.findMany({
            where: { stsrc: { not: Stsrc.D }, dinasId: { in: dinasIds } },
            select: { id: true, dinasId: true },
          }),
          prisma.msCabangDinas.findMany({
            where: { stsrc: { not: Stsrc.D }, dinasId: { in: dinasIds } },
            select: { id: true, dinasId: true },
          }),
        ])
      : [[], []];
  const categoryDinasById = new Map(categories.map((item) => [item.id, item.dinasId]));
  const branchDinasById = new Map(branches.map((item) => [item.id, item.dinasId]));
  const categoryIds = categories.map((item) => item.id);
  const branchIds = branches.map((item) => item.id);
  const days = 30;
  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);
  const startDate = new Date(endDate);
  startDate.setDate(endDate.getDate() - (days - 1));
  startDate.setHours(0, 0, 0, 0);
  const reports =
    categoryIds.length > 0 || branchIds.length > 0
      ? await prisma.trLaporan.findMany({
          where: {
            stsrc: { not: Stsrc.D },
            OR: [
              ...(categoryIds.length > 0 ? [{ kategoriId: { in: categoryIds } }] : []),
              ...(branchIds.length > 0 ? [{ cabangDinasId: { in: branchIds } }] : []),
            ],
          },
          select: {
            kategoriId: true,
            cabangDinasId: true,
            status: true,
            createdAt: true,
            resolvedAt: true,
          },
        })
      : [];
  const statsByDinas = new Map<
    string,
    {
      totalReports: number;
      activeReports: number;
      resolvedReports: number;
      rejectedReports: number;
      resolutionHours: number[];
    }
  >();
  const series = Array.from({ length: days }, (_, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);

    return {
      date: getDayKey(date),
      label: getDayLabel(date),
      total: 0,
      active: 0,
      resolved: 0,
    };
  });
  const seriesByDate = new Map(series.map((item) => [item.date, item]));

  reports.forEach((report) => {
    const dinasId =
      (report.cabangDinasId ? branchDinasById.get(report.cabangDinasId) : undefined) ??
      (report.kategoriId ? categoryDinasById.get(report.kategoriId) : undefined);
    if (!dinasId) return;

    const current = statsByDinas.get(dinasId) ?? {
      totalReports: 0,
      activeReports: 0,
      resolvedReports: 0,
      rejectedReports: 0,
      resolutionHours: [],
    };
    current.totalReports += 1;
    if (report.status === LaporanStatus.resolved) {
      current.resolvedReports += 1;
      if (report.resolvedAt) {
        const hours = (report.resolvedAt.getTime() - report.createdAt.getTime()) / 36e5;
        if (hours >= 0) current.resolutionHours.push(hours);
      }
    } else if (report.status === LaporanStatus.rejected) {
      current.rejectedReports += 1;
    } else {
      current.activeReports += 1;
    }
    statsByDinas.set(dinasId, current);

    if (report.createdAt >= startDate && report.createdAt <= endDate) {
      const point = seriesByDate.get(getDayKey(report.createdAt));
      if (!point) return;

      point.total += 1;
      if (report.status === LaporanStatus.resolved) {
        point.resolved += 1;
      } else if (report.status !== LaporanStatus.rejected) {
        point.active += 1;
      }
    }
  });

  const rows = dinas.map((item) => {
    const stats = statsByDinas.get(item.id) ?? {
      totalReports: 0,
      activeReports: 0,
      resolvedReports: 0,
      rejectedReports: 0,
      resolutionHours: [],
    };
    const averageResolutionHours =
      stats.resolutionHours.length > 0
        ? Math.round(
            stats.resolutionHours.reduce((sum, hours) => sum + hours, 0) /
              stats.resolutionHours.length,
          )
        : 0;

    return {
      id: item.id,
      code: item.code,
      name: item.name,
      short: item.short,
      isActive: item.isActive,
      totalBranches: item._count.cabang,
      totalCategories: item._count.kategori,
      totalReports: stats.totalReports,
      activeReports: stats.activeReports,
      resolvedReports: stats.resolvedReports,
      rejectedReports: stats.rejectedReports,
      averageResolutionHours,
    };
  });
  const resolvedRows = rows.filter((item) => item.averageResolutionHours > 0);

  return {
    days,
    summary: {
      totalDinas: rows.length,
      activeDinas: rows.filter((item) => item.isActive).length,
      inactiveDinas: rows.filter((item) => !item.isActive).length,
      totalBranches: rows.reduce((sum, item) => sum + item.totalBranches, 0),
      totalCategories: rows.reduce((sum, item) => sum + item.totalCategories, 0),
      totalReports: rows.reduce((sum, item) => sum + item.totalReports, 0),
      activeReports: rows.reduce((sum, item) => sum + item.activeReports, 0),
      resolvedReports: rows.reduce((sum, item) => sum + item.resolvedReports, 0),
      averageResolutionHours:
        resolvedRows.length > 0
          ? Math.round(
              resolvedRows.reduce((sum, item) => sum + item.averageResolutionHours, 0) /
                resolvedRows.length,
            )
          : 0,
    },
    topByReports: [...rows]
      .sort((a, b) => b.totalReports - a.totalReports)
      .slice(0, 6),
    coverage: [...rows]
      .sort(
        (a, b) =>
          b.totalBranches + b.totalCategories - (a.totalBranches + a.totalCategories),
      )
      .slice(0, 6),
    fastestResolution: resolvedRows
      .sort((a, b) => a.averageResolutionHours - b.averageResolutionHours)
      .slice(0, 6),
    series,
  };
}

export async function createDinas(input: {
  code: string;
  type?: string;
  name: string;
  short: string;
  wilayah?: string | null;
  description?: string | null;
  isActive?: boolean;
  routingPriority?: number;
}) {
  const existing = await prisma.msDinas.findUnique({ where: { code: input.code } });
  if (existing) {
    throw new AppError("Kode dinas sudah digunakan", 409);
  }

  return prisma.msDinas.create({
    data: {
      code: input.code,
      type: input.type ?? input.code,
      name: input.name,
      short: input.short,
      wilayah: input.wilayah ?? null,
      description: input.description ?? null,
      isActive: input.isActive ?? true,
      routingPriority: input.routingPriority ?? 100,
    },
  });
}

export async function updateDinas(
  id: string,
  input: {
    code?: string;
    type?: string;
    name?: string;
    short?: string;
    wilayah?: string | null;
    description?: string | null;
    isActive?: boolean;
    routingPriority?: number;
  },
) {
  const existing = await prisma.msDinas.findUnique({ where: { id } });
  if (!existing || existing.stsrc === Stsrc.D) {
    throw new AppError("Dinas tidak ditemukan", 404);
  }

  if (input.code && input.code !== existing.code) {
    const duplicate = await prisma.msDinas.findUnique({ where: { code: input.code } });
    if (duplicate) {
      throw new AppError("Kode dinas sudah digunakan", 409);
    }
  }

  return prisma.msDinas.update({
    where: { id },
    data: {
      code: input.code,
      type: input.type,
      name: input.name,
      short: input.short,
      wilayah: input.wilayah ?? undefined,
      description: input.description ?? undefined,
      isActive: input.isActive,
      routingPriority: input.routingPriority,
      stsrc: Stsrc.U,
    },
  });
}

export async function deleteDinas(id: string) {
  const [kategoriCount, cabangCount] = await Promise.all([
    prisma.msKategoriLaporan.count({ where: { dinasId: id, stsrc: { not: Stsrc.D } } }),
    prisma.msCabangDinas.count({ where: { dinasId: id, stsrc: { not: Stsrc.D } } }),
  ]);

  if (kategoriCount > 0 || cabangCount > 0) {
    throw new AppError(
      "Tidak bisa menghapus dinas yang masih punya kategori atau cabang aktif.",
      400,
      { kategoriCount, cabangCount },
    );
  }

  await prisma.msDinas.update({
    where: { id },
    data: { stsrc: Stsrc.D, isActive: false },
  });
  return { id };
}

export async function listAdminCabang(input: ListAdminCabangInput) {
  const where = getAdminCabangWhere(input);

  const [data, total] = await Promise.all([
    prisma.msCabangDinas.findMany({
      where,
      orderBy: getAdminCabangOrderBy(input),
      skip: input.pagination.skip,
      take: input.pagination.take,
      include: {
        dinas: {
          select: { id: true, code: true, type: true, name: true, short: true },
        },
        _count: { select: { petugas: true, laporan: true } },
      },
    }),
    prisma.msCabangDinas.count({ where }),
  ]);

  return {
    data,
    total,
  };
}

export async function getAdminCabangActivity(input: Omit<ListAdminCabangInput, "pagination">) {
  const where = getAdminCabangWhere({
    ...input,
    pagination: { page: 1, limit: 1, skip: 0, take: 1 },
  });

  const cabang = await prisma.msCabangDinas.findMany({
    where,
    orderBy: { name: "asc" },
    include: {
      dinas: {
        select: {
          id: true,
          name: true,
          short: true,
          _count: { select: { kategori: true } },
        },
      },
      _count: { select: { petugas: true, laporan: true } },
    },
  });
  const cabangIds = cabang.map((item) => item.id);
  const days = 30;
  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);
  const startDate = new Date(endDate);
  startDate.setDate(endDate.getDate() - (days - 1));
  startDate.setHours(0, 0, 0, 0);
  const [statusGroups, resolvedDurations, periodReports] =
    cabangIds.length > 0
      ? await Promise.all([
          prisma.trLaporan.groupBy({
            by: ["cabangDinasId", "status"],
            where: {
              stsrc: { not: Stsrc.D },
              cabangDinasId: { in: cabangIds },
            },
            _count: { _all: true },
          }),
          prisma.trLaporan.findMany({
            where: {
              stsrc: { not: Stsrc.D },
              cabangDinasId: { in: cabangIds },
              resolvedAt: { not: null },
            },
            select: {
              cabangDinasId: true,
              createdAt: true,
              resolvedAt: true,
            },
          }),
          prisma.trLaporan.findMany({
            where: {
              stsrc: { not: Stsrc.D },
              cabangDinasId: { in: cabangIds },
              createdAt: { gte: startDate, lte: endDate },
            },
            select: {
              createdAt: true,
              status: true,
            },
          }),
        ])
      : [[], [], []];

  const reportStatsByCabang = new Map<
    string,
    { totalReports: number; activeReports: number; resolvedReports: number; rejectedReports: number }
  >();

  statusGroups.forEach((group) => {
    if (!group.cabangDinasId) return;
    const current = reportStatsByCabang.get(group.cabangDinasId) ?? {
      totalReports: 0,
      activeReports: 0,
      resolvedReports: 0,
      rejectedReports: 0,
    };
    current.totalReports += group._count._all;
    if (group.status === LaporanStatus.resolved) {
      current.resolvedReports += group._count._all;
    } else if (group.status === LaporanStatus.rejected) {
      current.rejectedReports += group._count._all;
    } else {
      current.activeReports += group._count._all;
    }
    reportStatsByCabang.set(group.cabangDinasId, current);
  });

  const resolutionByCabang = new Map<string, number[]>();
  resolvedDurations.forEach((report) => {
    if (!report.cabangDinasId || !report.resolvedAt) return;
    const hours = (report.resolvedAt.getTime() - report.createdAt.getTime()) / 36e5;
    if (hours < 0) return;
    const current = resolutionByCabang.get(report.cabangDinasId) ?? [];
    current.push(hours);
    resolutionByCabang.set(report.cabangDinasId, current);
  });

  const rows = cabang.map((item) => {
    const reportStats = reportStatsByCabang.get(item.id) ?? {
      totalReports: 0,
      activeReports: 0,
      resolvedReports: 0,
      rejectedReports: 0,
    };
    const resolutionHours = resolutionByCabang.get(item.id) ?? [];
    const averageResolutionHours =
      resolutionHours.length > 0
        ? Math.round(
            resolutionHours.reduce((sum, hours) => sum + hours, 0) /
              resolutionHours.length,
          )
        : 0;

    return {
      id: item.id,
      name: item.name,
      wilayah: item.wilayah,
      dinasId: item.dinasId,
      dinasName: item.dinas.name,
      dinasShort: item.dinas.short,
      isRoutingEnabled: item.isRoutingEnabled,
      coverageRadiusKm: item.coverageRadiusKm,
      serviceTagsCount: item.serviceTags?.length ?? 0,
      petugasCount: item._count.petugas,
      categoryCoverage: item.dinas._count.kategori,
      ...reportStats,
      averageResolutionHours,
    };
  });

  const totalReports = rows.reduce((sum, item) => sum + item.totalReports, 0);
  const activeReports = rows.reduce((sum, item) => sum + item.activeReports, 0);
  const resolvedReports = rows.reduce((sum, item) => sum + item.resolvedReports, 0);
  const resolvedRows = rows.filter((item) => item.averageResolutionHours > 0);
  const averageResolutionHours =
    resolvedRows.length > 0
      ? Math.round(
          resolvedRows.reduce((sum, item) => sum + item.averageResolutionHours, 0) /
            resolvedRows.length,
        )
      : 0;
  const dinasMap = new Map<
    string,
    {
      id: string;
      name: string;
      short: string | null;
      totalBranches: number;
      routingEnabled: number;
      totalReports: number;
      petugasCount: number;
    }
  >();

  rows.forEach((item) => {
    const current = dinasMap.get(item.dinasId) ?? {
      id: item.dinasId,
      name: item.dinasName,
      short: item.dinasShort,
      totalBranches: 0,
      routingEnabled: 0,
      totalReports: 0,
      petugasCount: 0,
    };
    current.totalBranches += 1;
    current.routingEnabled += item.isRoutingEnabled ? 1 : 0;
    current.totalReports += item.totalReports;
    current.petugasCount += item.petugasCount;
    dinasMap.set(item.dinasId, current);
  });
  const series = Array.from({ length: days }, (_, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);

    return {
      date: getDayKey(date),
      label: getDayLabel(date),
      total: 0,
      active: 0,
      resolved: 0,
    };
  });
  const seriesByDate = new Map(series.map((item) => [item.date, item]));

  periodReports.forEach((report) => {
    const point = seriesByDate.get(getDayKey(report.createdAt));
    if (!point) return;

    point.total += 1;
    if (report.status === LaporanStatus.resolved) {
      point.resolved += 1;
      return;
    }
    if (report.status !== LaporanStatus.rejected) {
      point.active += 1;
    }
  });

  return {
    days,
    summary: {
      totalBranches: rows.length,
      routingEnabled: rows.filter((item) => item.isRoutingEnabled).length,
      routingDisabled: rows.filter((item) => !item.isRoutingEnabled).length,
      totalReports,
      activeReports,
      resolvedReports,
      averageResolutionHours,
      totalPetugas: rows.reduce((sum, item) => sum + item.petugasCount, 0),
    },
    topByReports: [...rows]
      .sort((a, b) => b.totalReports - a.totalReports)
      .slice(0, 6),
    topByCoverage: [...rows]
      .sort(
        (a, b) =>
          b.categoryCoverage - a.categoryCoverage ||
          b.serviceTagsCount - a.serviceTagsCount ||
          (b.coverageRadiusKm ?? 0) - (a.coverageRadiusKm ?? 0),
      )
      .slice(0, 6),
    fastestResolution: resolvedRows
      .sort((a, b) => a.averageResolutionHours - b.averageResolutionHours)
      .slice(0, 6),
    series,
    byDinas: Array.from(dinasMap.values())
      .sort((a, b) => b.totalReports - a.totalReports || b.totalBranches - a.totalBranches)
      .slice(0, 8),
  };
}

export async function createCabang(input: {
  dinasId: string;
  name: string;
  wilayah: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  phone?: string | null;
  province?: string | null;
  cityRegency?: string | null;
  coverageRadiusKm?: number | null;
  isRoutingEnabled?: boolean;
  serviceTags?: string[];
  photos?: string[];
  metadata?: Record<string, unknown> | null;
}) {
  const dinas = await prisma.msDinas.findFirst({
    where: { id: input.dinasId, stsrc: { not: Stsrc.D } },
  });
  if (!dinas) {
    throw new AppError("Dinas tidak ditemukan", 404);
  }

  return prisma.msCabangDinas.create({
    data: {
      dinasId: input.dinasId,
      name: input.name,
      wilayah: input.wilayah,
      address: input.address ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      phone: input.phone ?? null,
      province: input.province ?? null,
      cityRegency: input.cityRegency ?? null,
      coverageRadiusKm: input.coverageRadiusKm ?? null,
      isRoutingEnabled: input.isRoutingEnabled ?? true,
      serviceTags: input.serviceTags ?? [],
      photos: input.photos ?? [],
      metadata: (input.metadata ?? null) as Prisma.InputJsonValue,
    },
  });
}

export async function updateCabang(
  id: string,
  input: {
    name?: string;
    wilayah?: string;
    address?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    phone?: string | null;
    province?: string | null;
    cityRegency?: string | null;
    coverageRadiusKm?: number | null;
    isRoutingEnabled?: boolean;
    serviceTags?: string[];
    photos?: string[];
    metadata?: Record<string, unknown> | null;
  },
) {
  const existing = await prisma.msCabangDinas.findUnique({ where: { id } });
  if (!existing || existing.stsrc === Stsrc.D) {
    throw new AppError("Cabang dinas tidak ditemukan", 404);
  }

  return prisma.msCabangDinas.update({
    where: { id },
    data: {
      name: input.name,
      wilayah: input.wilayah,
      address: input.address ?? undefined,
      latitude: input.latitude ?? undefined,
      longitude: input.longitude ?? undefined,
      phone: input.phone ?? undefined,
      province: input.province ?? undefined,
      cityRegency: input.cityRegency ?? undefined,
      coverageRadiusKm: input.coverageRadiusKm ?? undefined,
      isRoutingEnabled: input.isRoutingEnabled,
      serviceTags: input.serviceTags,
      photos: input.photos,
      metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      stsrc: Stsrc.U,
    },
  });
}

export async function deleteCabang(id: string) {
  const [petugasCount, laporanCount] = await Promise.all([
    prisma.msPetugasDinas.count({ where: { cabangDinasId: id } }),
    prisma.trLaporan.count({ where: { cabangDinasId: id, stsrc: { not: Stsrc.D } } }),
  ]);

  if (petugasCount > 0 || laporanCount > 0) {
    throw new AppError(
      "Tidak bisa menghapus cabang yang masih punya petugas atau laporan.",
      400,
      { petugasCount, laporanCount },
    );
  }

  await prisma.msCabangDinas.update({
    where: { id },
    data: { stsrc: Stsrc.D, isRoutingEnabled: false },
  });
  return { id };
}

export async function listAdminKategori(input: ListAdminKategoriInput) {
  const where = getAdminKategoriWhere(input);

  const [data, total] = await Promise.all([
    prisma.msKategoriLaporan.findMany({
      where,
      orderBy: getAdminKategoriOrderBy(input),
      skip: input.pagination.skip,
      take: input.pagination.take,
      include: {
        dinas: { select: { id: true, code: true, name: true, short: true } },
        _count: { select: { laporan: true } },
      },
    }),
    prisma.msKategoriLaporan.count({ where }),
  ]);

  return {
    data,
    total,
  };
}

export async function getAdminKategoriActivity(input: Omit<ListAdminKategoriInput, "pagination">) {
  const where = getAdminKategoriWhere({
    ...input,
    pagination: { page: 1, limit: 1, skip: 0, take: 1 },
  });

  const categories = await prisma.msKategoriLaporan.findMany({
    where,
    orderBy: { name: "asc" },
    include: {
      dinas: { select: { id: true, name: true, short: true } },
    },
  });

  const categoryIds = categories.map((category) => category.id);
  const days = 30;
  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);
  const startDate = new Date(endDate);
  startDate.setDate(endDate.getDate() - (days - 1));
  startDate.setHours(0, 0, 0, 0);
  const reportGroups =
    categoryIds.length > 0
      ? await prisma.trLaporan.groupBy({
          by: ["kategoriId"],
          where: {
            stsrc: { not: Stsrc.D },
            kategoriId: { in: categoryIds },
          },
          _count: { _all: true },
        })
      : [];
  const periodReports =
    categoryIds.length > 0
      ? await prisma.trLaporan.findMany({
          where: {
            stsrc: { not: Stsrc.D },
            kategoriId: { in: categoryIds },
            createdAt: { gte: startDate, lte: endDate },
          },
          select: {
            createdAt: true,
            status: true,
          },
        })
      : [];
  const reportCountByCategory = new Map(
    reportGroups.map((group) => [group.kategoriId ?? "", group._count._all]),
  );

  const categoryRows = categories.map((category) => ({
    id: category.id,
    code: category.code,
    name: category.name,
    dinasId: category.dinasId,
    dinasName: category.dinas.name,
    dinasShort: category.dinas.short,
    isActive: category.isActive,
    slaHours: category.slaHours,
    urgencyWeight: category.urgencyWeight,
    totalReports: reportCountByCategory.get(category.id) ?? 0,
  }));
  const totalReports = categoryRows.reduce((sum, item) => sum + item.totalReports, 0);
  const activeCategories = categoryRows.filter((item) => item.isActive).length;
  const categoriesWithSla = categoryRows.filter((item) => item.slaHours != null);
  const averageUrgency =
    categoryRows.length > 0
      ? Math.round(
          categoryRows.reduce((sum, item) => sum + item.urgencyWeight, 0) /
            categoryRows.length,
        )
      : 0;
  const averageSlaHours =
    categoriesWithSla.length > 0
      ? Math.round(
          categoriesWithSla.reduce((sum, item) => sum + (item.slaHours ?? 0), 0) /
            categoriesWithSla.length,
        )
      : 0;
  const dinasMap = new Map<
    string,
    {
      id: string;
      name: string;
      short: string | null;
      totalCategories: number;
      activeCategories: number;
      totalReports: number;
    }
  >();

  categoryRows.forEach((category) => {
    const current = dinasMap.get(category.dinasId) ?? {
      id: category.dinasId,
      name: category.dinasName,
      short: category.dinasShort,
      totalCategories: 0,
      activeCategories: 0,
      totalReports: 0,
    };

    current.totalCategories += 1;
    current.activeCategories += category.isActive ? 1 : 0;
    current.totalReports += category.totalReports;
    dinasMap.set(category.dinasId, current);
  });
  const series = Array.from({ length: days }, (_, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);

    return {
      date: getDayKey(date),
      label: getDayLabel(date),
      total: 0,
      resolved: 0,
      active: 0,
    };
  });
  const seriesByDate = new Map(series.map((item) => [item.date, item]));

  periodReports.forEach((report) => {
    const point = seriesByDate.get(getDayKey(report.createdAt));
    if (!point) return;

    point.total += 1;
    if (report.status === LaporanStatus.resolved) {
      point.resolved += 1;
      return;
    }
    if (report.status !== LaporanStatus.rejected) {
      point.active += 1;
    }
  });

  return {
    days,
    summary: {
      totalCategories: categoryRows.length,
      activeCategories,
      inactiveCategories: categoryRows.length - activeCategories,
      totalReports,
      averageUrgency,
      averageSlaHours,
    },
    topByReports: [...categoryRows]
      .sort((a, b) => b.totalReports - a.totalReports)
      .slice(0, 8),
    topByUrgency: [...categoryRows]
      .sort((a, b) => b.urgencyWeight - a.urgencyWeight)
      .slice(0, 6),
    topBySla: [...categoryRows]
      .filter((item) => item.slaHours != null)
      .sort((a, b) => (b.slaHours ?? 0) - (a.slaHours ?? 0))
      .slice(0, 6),
    series,
    byDinas: Array.from(dinasMap.values())
      .sort((a, b) => b.totalReports - a.totalReports || b.totalCategories - a.totalCategories)
      .slice(0, 8),
  };
}

export async function createKategori(input: {
  code: string;
  name: string;
  description?: string | null;
  slaHours?: number | null;
  urgencyWeight?: number;
  keywords?: string[];
  isActive?: boolean;
  dinasId: string;
}) {
  const existing = await prisma.msKategoriLaporan.findUnique({ where: { code: input.code } });
  if (existing) {
    throw new AppError("Kode kategori sudah digunakan", 409);
  }

  const dinas = await prisma.msDinas.findFirst({
    where: { id: input.dinasId, stsrc: { not: Stsrc.D } },
  });
  if (!dinas) {
    throw new AppError("Dinas tidak ditemukan", 404);
  }

  return prisma.msKategoriLaporan.create({
    data: {
      code: input.code,
      name: input.name,
      description: input.description ?? null,
      slaHours: input.slaHours ?? null,
      urgencyWeight: input.urgencyWeight ?? 50,
      keywords: input.keywords ?? [],
      isActive: input.isActive ?? true,
      dinasId: input.dinasId,
    },
  });
}

export async function updateKategori(
  id: string,
  input: {
    code?: string;
    name?: string;
    description?: string | null;
    slaHours?: number | null;
    urgencyWeight?: number;
    keywords?: string[];
    isActive?: boolean;
    dinasId?: string;
  },
) {
  const existing = await prisma.msKategoriLaporan.findUnique({ where: { id } });
  if (!existing || existing.stsrc === Stsrc.D) {
    throw new AppError("Kategori tidak ditemukan", 404);
  }

  if (input.code && input.code !== existing.code) {
    const duplicate = await prisma.msKategoriLaporan.findUnique({ where: { code: input.code } });
    if (duplicate) {
      throw new AppError("Kode kategori sudah digunakan", 409);
    }
  }

  if (input.dinasId) {
    const dinas = await prisma.msDinas.findFirst({
      where: { id: input.dinasId, stsrc: { not: Stsrc.D } },
    });
    if (!dinas) {
      throw new AppError("Dinas tidak ditemukan", 404);
    }
  }

  return prisma.msKategoriLaporan.update({
    where: { id },
    data: {
      code: input.code,
      name: input.name,
      description: input.description ?? undefined,
      slaHours: input.slaHours ?? undefined,
      urgencyWeight: input.urgencyWeight ?? undefined,
      keywords: input.keywords ?? undefined,
      isActive: input.isActive,
      dinasId: input.dinasId,
      stsrc: Stsrc.U,
    },
  });
}

export async function deleteKategori(id: string) {
  const laporanCount = await prisma.trLaporan.count({
    where: { kategoriId: id, stsrc: { not: Stsrc.D } },
  });
  if (laporanCount > 0) {
    throw new AppError("Tidak bisa menghapus kategori yang sudah dipakai laporan.", 400, {
      laporanCount,
    });
  }

  await prisma.msKategoriLaporan.update({
    where: { id },
    data: { stsrc: Stsrc.D, isActive: false },
  });
  return { id };
}
