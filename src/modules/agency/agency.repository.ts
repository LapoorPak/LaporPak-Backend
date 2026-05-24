import { prisma } from "../../config/db.js";
import { Stsrc, type Prisma } from "../../generated/prisma/client.js";
import type { PaginationParams } from "../../utils/apiResponse.js";

const notDeleted = { not: Stsrc.D };

export function findAgencies(
  where: Prisma.DinasWhereInput,
  pagination: PaginationParams,
) {
  return prisma.dinas.findMany({
    where,
    include: { kategori: { where: { stsrc: notDeleted } } },
    orderBy: { name: "asc" },
    skip: pagination.skip,
    take: pagination.take,
  });
}

export function countAgencies(where: Prisma.DinasWhereInput) {
  return prisma.dinas.count({ where });
}

export function groupAgenciesByType(where: Prisma.DinasWhereInput) {
  return prisma.dinas.groupBy({
    by: ["type"],
    where,
    _count: {
      _all: true,
    },
  });
}

export function findAgencyLocations(where: Prisma.CabangDinasWhereInput) {
  return prisma.cabangDinas.findMany({
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
  });
}

export function countAgencyLocations(where: Prisma.CabangDinasWhereInput) {
  return prisma.cabangDinas.count({ where });
}

export function groupAgencyLocationsByDinas(where: Prisma.CabangDinasWhereInput) {
  return prisma.cabangDinas.groupBy({
    by: ["dinasId"],
    where,
    _count: {
      _all: true,
    },
  });
}

export function groupAgencyLocationsByCityRegency(where: Prisma.CabangDinasWhereInput) {
  return prisma.cabangDinas.groupBy({
    by: ["cityRegency"],
    where,
    _count: {
      _all: true,
    },
  });
}

export function findAgencySummariesByIds(ids: string[]) {
  return prisma.dinas.findMany({
    where: { id: { in: ids }, stsrc: notDeleted },
    select: { id: true, code: true, type: true, name: true },
  });
}

export function findAgencyById(id: string) {
  return prisma.dinas.findUnique({
    where: { id, stsrc: notDeleted },
    include: {
      kategori: { where: { stsrc: notDeleted } },
      cabang: {
        where: { stsrc: notDeleted },
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
}

export function findAgencyId(id: string) {
  return prisma.dinas.findUnique({
    where: { id, stsrc: notDeleted },
    select: { id: true },
  });
}

export function groupAgencyReportsByStatus(agencyId: string) {
  return prisma.laporan.groupBy({
    by: ["status"],
    where: { kategori: { dinasId: agencyId }, stsrc: notDeleted },
    _count: true,
  });
}

export function findAgencyReports(
  where: Prisma.LaporanWhereInput,
  pagination: PaginationParams,
) {
  return prisma.laporan.findMany({
    where,
    include: {
      kategori: { include: { dinas: true } },
      createdBy: { select: { id: true, name: true, image: true } },
    },
    orderBy: { createdAt: "desc" },
    skip: pagination.skip,
    take: pagination.take,
  });
}

export function countAgencyReports(where: Prisma.LaporanWhereInput) {
  return prisma.laporan.count({ where });
}

export function groupAgencyReportsByReportStatus(where: Prisma.LaporanWhereInput) {
  return prisma.laporan.groupBy({
    by: ["status"],
    where,
    _count: {
      _all: true,
    },
  });
}

export function groupAgencyReportsByCategory(where: Prisma.LaporanWhereInput) {
  return prisma.laporan.groupBy({
    by: ["kategoriId"],
    where,
    _count: {
      _all: true,
    },
  });
}

export function findCategorySummariesByIds(ids: string[]) {
  return prisma.kategoriLaporan.findMany({
    where: { id: { in: ids }, stsrc: notDeleted },
    select: { id: true, code: true, name: true },
  });
}
