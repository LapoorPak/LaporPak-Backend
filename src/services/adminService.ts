import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "../config/db.js";
import { LaporanStatus, Prisma } from "../generated/prisma/client.js";
import { AppError } from "../middleware/authMiddleware.js";
import type {
  ListAdminCabangInput,
  ListAdminDinasInput,
  ListAdminKategoriInput,
  ListAdminUsersInput,
} from "../types/admin.js";

type ReportVoteSummary = {
  upvotes: number;
  downvotes: number;
  voteScore: number;
};

function emptyReportVoteSummary(): ReportVoteSummary {
  return {
    upvotes: 0,
    downvotes: 0,
    voteScore: 0,
  };
}

async function getAdminReportVoteSummaries(laporanIds: string[]) {
  const uniqueIds = [...new Set(laporanIds)].filter(Boolean);
  const voteMap = new Map<string, ReportVoteSummary>();

  for (const id of uniqueIds) {
    voteMap.set(id, emptyReportVoteSummary());
  }

  if (uniqueIds.length === 0) {
    return voteMap;
  }

  const voteGroups = await prisma.laporanVote.groupBy({
    by: ["laporanId", "value"],
    where: { laporanId: { in: uniqueIds } },
    _count: { _all: true },
  });

  for (const group of voteGroups) {
    const summary = voteMap.get(group.laporanId) ?? emptyReportVoteSummary();

    if (group.value > 0) {
      summary.upvotes += group._count._all;
    } else if (group.value < 0) {
      summary.downvotes += group._count._all;
    }

    summary.voteScore = summary.upvotes - summary.downvotes;
    voteMap.set(group.laporanId, summary);
  }

  return voteMap;
}

function withReportVoteSummary<T extends { id: string }>(report: T, voteMap: Map<string, ReportVoteSummary>) {
  return {
    ...report,
    ...(voteMap.get(report.id) ?? emptyReportVoteSummary()),
  };
}

export async function getAdminOverview() {
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
    topDinasRaw,
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

  const byStatus: Record<string, number> = {};
  for (const row of statusCounts) {
    byStatus[row.status] = row._count._all;
  }

  // Aggregate report counts by dinasId via kategori relation
  const topKategoriRaw = topDinasRaw; // renamed for clarity (was topDinasRaw, now by kategoriId)
  const kategoriIds = topKategoriRaw.map((r) => r.kategoriId).filter(Boolean) as string[];
  const kategoriList = kategoriIds.length > 0
    ? await prisma.kategoriLaporan.findMany({
        where: { id: { in: kategoriIds } },
        select: { id: true, dinasId: true },
      })
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
        (await prisma.dinas.findMany({
          where: { id: { in: topDinasIds } },
          select: { id: true, name: true, short: true },
        })).map((d) => [d.id, d]),
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

function buildSearchOr(search?: string, fields: string[] = []) {
  if (!search) return [];
  return fields.map((field) => ({
    [field]: { contains: search, mode: "insensitive" as const },
  }));
}

export async function listAdminDinas(input: ListAdminDinasInput) {
  const where = {
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
  };

  const [data, total] = await Promise.all([
    prisma.dinas.findMany({
      where,
      orderBy: { name: "asc" },
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
    prisma.dinas.count({ where }),
  ]);

  return {
    data,
    total,
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
  const existing = await prisma.dinas.findUnique({ where: { code: input.code } });
  if (existing) {
    throw new AppError("Kode dinas sudah digunakan", 409);
  }

  return prisma.dinas.create({
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
  const existing = await prisma.dinas.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError("Dinas tidak ditemukan", 404);
  }

  if (input.code && input.code !== existing.code) {
    const duplicate = await prisma.dinas.findUnique({ where: { code: input.code } });
    if (duplicate) {
      throw new AppError("Kode dinas sudah digunakan", 409);
    }
  }

  return prisma.dinas.update({
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
    },
  });
}

export async function deleteDinas(id: string) {
  const [kategoriCount, cabangCount] = await Promise.all([
    prisma.kategoriLaporan.count({ where: { dinasId: id } }),
    prisma.cabangDinas.count({ where: { dinasId: id } }),
  ]);

  if (kategoriCount > 0 || cabangCount > 0) {
    throw new AppError(
      "Tidak bisa menghapus dinas yang masih punya kategori atau cabang aktif.",
      400,
      { kategoriCount, cabangCount },
    );
  }

  await prisma.dinas.delete({ where: { id } });
  return { id };
}

export async function listAdminCabang(input: ListAdminCabangInput) {
  const where = {
    ...(input.dinasId ? { dinasId: input.dinasId } : {}),
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
  };

  const [data, total] = await Promise.all([
    prisma.cabangDinas.findMany({
      where,
      orderBy: { name: "asc" },
      skip: input.pagination.skip,
      take: input.pagination.take,
      include: {
        dinas: {
          select: { id: true, code: true, type: true, name: true, short: true },
        },
        _count: { select: { petugas: true, laporan: true } },
      },
    }),
    prisma.cabangDinas.count({ where }),
  ]);

  return {
    data,
    total,
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
  const dinas = await prisma.dinas.findUnique({ where: { id: input.dinasId } });
  if (!dinas) {
    throw new AppError("Dinas tidak ditemukan", 404);
  }

  return prisma.cabangDinas.create({
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
  const existing = await prisma.cabangDinas.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError("Cabang dinas tidak ditemukan", 404);
  }

  return prisma.cabangDinas.update({
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
    },
  });
}

export async function deleteCabang(id: string) {
  const [petugasCount, laporanCount] = await Promise.all([
    prisma.petugasDinas.count({ where: { cabangDinasId: id } }),
    prisma.laporan.count({ where: { cabangDinasId: id } }),
  ]);

  if (petugasCount > 0 || laporanCount > 0) {
    throw new AppError(
      "Tidak bisa menghapus cabang yang masih punya petugas atau laporan.",
      400,
      { petugasCount, laporanCount },
    );
  }

  await prisma.cabangDinas.delete({ where: { id } });
  return { id };
}

export async function listAdminKategori(input: ListAdminKategoriInput) {
  const where = {
    ...(input.dinasId ? { dinasId: input.dinasId } : {}),
    ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
    ...(input.search
      ? {
          OR: [
            { name: { contains: input.search, mode: "insensitive" as const } },
            { code: { contains: input.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.kategoriLaporan.findMany({
      where,
      orderBy: { name: "asc" },
      skip: input.pagination.skip,
      take: input.pagination.take,
      include: {
        dinas: { select: { id: true, code: true, name: true, short: true } },
        _count: { select: { laporan: true } },
      },
    }),
    prisma.kategoriLaporan.count({ where }),
  ]);

  return {
    data,
    total,
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
  const existing = await prisma.kategoriLaporan.findUnique({ where: { code: input.code } });
  if (existing) {
    throw new AppError("Kode kategori sudah digunakan", 409);
  }

  const dinas = await prisma.dinas.findUnique({ where: { id: input.dinasId } });
  if (!dinas) {
    throw new AppError("Dinas tidak ditemukan", 404);
  }

  return prisma.kategoriLaporan.create({
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
  const existing = await prisma.kategoriLaporan.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError("Kategori tidak ditemukan", 404);
  }

  if (input.code && input.code !== existing.code) {
    const duplicate = await prisma.kategoriLaporan.findUnique({ where: { code: input.code } });
    if (duplicate) {
      throw new AppError("Kode kategori sudah digunakan", 409);
    }
  }

  if (input.dinasId) {
    const dinas = await prisma.dinas.findUnique({ where: { id: input.dinasId } });
    if (!dinas) {
      throw new AppError("Dinas tidak ditemukan", 404);
    }
  }

  return prisma.kategoriLaporan.update({
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
    },
  });
}

export async function deleteKategori(id: string) {
  const laporanCount = await prisma.laporan.count({ where: { kategoriId: id } });
  if (laporanCount > 0) {
    throw new AppError("Tidak bisa menghapus kategori yang sudah dipakai laporan.", 400, {
      laporanCount,
    });
  }

  await prisma.kategoriLaporan.delete({ where: { id } });
  return { id };
}

export async function listAdminUsers(input: ListAdminUsersInput) {
  const where = {
    ...(input.role ? { role: input.role } : {}),
    ...(input.banned === undefined ? {} : { banned: input.banned }),
    ...(input.hasPetugas === undefined
      ? {}
      : {
          petugas: input.hasPetugas ? { isNot: null } : { is: null },
        }),
    ...(input.search
      ? {
          OR: [
            { name: { contains: input.search, mode: "insensitive" as const } },
            { email: { contains: input.search, mode: "insensitive" as const } },
            { phone: { contains: input.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: input.pagination.skip,
      take: input.pagination.take,
      include: {
        petugas: {
          include: {
            cabangDinas: {
              include: { dinas: true },
            },
          },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return { data, total };
}

export async function getAdminUserDetail(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      petugas: {
        include: {
          cabangDinas: {
            include: { dinas: true },
          },
        },
      },
      accounts: true,
    },
  });

  if (!user) {
    throw new AppError("User tidak ditemukan", 404);
  }

  return user;
}

export async function updateAdminUser(
  id: string,
  input: {
    name?: string;
    email?: string;
    phone?: string | null;
    role?: string;
    banned?: boolean;
    banReason?: string | null;
    banExpires?: Date | null;
  },
) {
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError("User tidak ditemukan", 404);
  }

  if (input.email && input.email !== existing.email) {
    const duplicate = await prisma.user.findUnique({ where: { email: input.email } });
    if (duplicate) {
      throw new AppError("Email sudah digunakan", 409);
    }
  }

  return prisma.user.update({
    where: { id },
    data: {
      name: input.name,
      email: input.email,
      phone: input.phone ?? undefined,
      role: input.role,
      banned: input.banned,
      banReason: input.banReason ?? undefined,
      banExpires: input.banExpires ?? undefined,
    },
  });
}

export async function resetAdminUserPassword(input: { userId: string; newPassword: string }) {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    include: { accounts: true },
  });

  if (!user) {
    throw new AppError("User tidak ditemukan", 404);
  }

  const passwordHash = await hashPassword(input.newPassword);
  const credentialAccount = user.accounts.find((acc) => acc.providerId === "credential");

  if (credentialAccount) {
    await prisma.account.update({
      where: { id: credentialAccount.id },
      data: { password: passwordHash },
    });
  } else {
    await prisma.account.create({
      data: {
        id: randomUUID(),
        accountId: user.id,
        providerId: "credential",
        userId: user.id,
        password: passwordHash,
      },
    });
  }

  return { userId: user.id };
}

export async function assignPetugasToUser(input: {
  userId: string;
  cabangDinasId: string;
  nip?: string;
}) {
  const [user, cabang] = await Promise.all([
    prisma.user.findUnique({ where: { id: input.userId } }),
    prisma.cabangDinas.findUnique({
      where: { id: input.cabangDinasId },
      include: { dinas: true },
    }),
  ]);

  if (!user) {
    throw new AppError("User tidak ditemukan", 404);
  }

  if (!cabang) {
    throw new AppError("Cabang dinas tidak ditemukan", 404);
  }

  const nip = input.nip ?? `ADM-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  const petugas = await prisma.petugasDinas.upsert({
    where: { userId: user.id },
    update: {
      cabangDinasId: cabang.id,
      nip,
    },
    create: {
      userId: user.id,
      cabangDinasId: cabang.id,
      nip,
    },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { role: cabang.dinas.type || cabang.dinas.code },
  });

  return {
    petugas,
    cabangDinas: cabang,
  };
}

// ─── Admin Laporan Management ──────────────────────────────────────────────────

export async function listAdminLaporan(input: {
  pagination: { skip: number; take: number };
  search?: string;
  status?: string;
  dinasId?: string;
  cabangDinasId?: string;
  kategoriId?: string;
}) {
  const filters: Prisma.LaporanWhereInput[] = [];

  if (input.status && Object.values(LaporanStatus).includes(input.status as LaporanStatus)) {
    filters.push({ status: input.status as LaporanStatus });
  }

  if (input.dinasId) {
    filters.push({ kategori: { dinasId: input.dinasId } });
  }

  if (input.cabangDinasId) {
    filters.push({ cabangDinasId: input.cabangDinasId });
  }

  if (input.kategoriId) {
    filters.push({ kategoriId: input.kategoriId });
  }

  if (input.search) {
    filters.push({
      OR: [
        { title: { contains: input.search, mode: "insensitive" } },
        { description: { contains: input.search, mode: "insensitive" } },
        { address: { contains: input.search, mode: "insensitive" } },
        { kategori: { name: { contains: input.search, mode: "insensitive" } } },
        { cabangDinas: { name: { contains: input.search, mode: "insensitive" } } },
        { createdBy: { name: { contains: input.search, mode: "insensitive" } } },
      ],
    });
  }

  const where: Prisma.LaporanWhereInput = filters.length > 0 ? { AND: filters } : {};

  const [data, total] = await Promise.all([
    prisma.laporan.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: input.pagination.skip,
      take: input.pagination.take,
      include: {
        kategori: { include: { dinas: { select: { id: true, code: true, name: true, short: true } } } },
        cabangDinas: { select: { id: true, name: true, wilayah: true } },
        createdBy: { select: { id: true, name: true, email: true, image: true } },
      },
    }),
    prisma.laporan.count({ where }),
  ]);

  const voteMap = await getAdminReportVoteSummaries(data.map((laporan) => laporan.id));

  return {
    data: data.map((laporan) => withReportVoteSummary(laporan, voteMap)),
    total,
  };
}

export async function getAdminLaporanDetail(id: string) {
  const laporan = await prisma.laporan.findUnique({
    where: { id },
    include: {
      kategori: { include: { dinas: true } },
      cabangDinas: { include: { dinas: true } },
      createdBy: { select: { id: true, name: true, email: true, image: true } },
      assignedTo: { select: { id: true, name: true, email: true, image: true } },
      resolvedBy: { select: { id: true, name: true, email: true } },
    },
  });

  if (!laporan) {
    throw new AppError("Laporan tidak ditemukan", 404);
  }

  const voteMap = await getAdminReportVoteSummaries([laporan.id]);
  return withReportVoteSummary(laporan, voteMap);
}

export async function adminUpdateLaporanStatus(input: {
  id: string;
  status: string;
  agencyNote?: string | null;
  resolutionNote?: string | null;
  adminUserId: string;
}) {
  const laporan = await prisma.laporan.findUnique({ where: { id: input.id } });
  if (!laporan) {
    throw new AppError("Laporan tidak ditemukan", 404);
  }

  const validStatuses = ["pending", "verified", "in_progress", "clarification_requested", "resolved", "rejected"];
  if (!validStatuses.includes(input.status)) {
    throw new AppError(`Status tidak valid. Harus salah satu dari: ${validStatuses.join(", ")}`, 400);
  }

  const updated = await prisma.laporan.update({
    where: { id: input.id },
    data: {
      status: input.status as LaporanStatus,
      ...(input.agencyNote !== undefined ? { agencyNote: input.agencyNote } : {}),
      ...(input.resolutionNote !== undefined ? { resolutionNote: input.resolutionNote } : {}),
      resolvedAt: input.status === "resolved" ? new Date() : undefined,
      resolvedById: input.status === "resolved" ? input.adminUserId : undefined,
    },
    include: {
      kategori: { include: { dinas: true } },
      cabangDinas: { include: { dinas: true } },
      createdBy: { select: { id: true, name: true, email: true, image: true } },
    },
  });
  const voteMap = await getAdminReportVoteSummaries([updated.id]);
  return withReportVoteSummary(updated, voteMap);
}

export async function adminAssignLaporan(id: string, cabangDinasId: string) {
  const [laporan, cabang] = await Promise.all([
    prisma.laporan.findUnique({ where: { id } }),
    prisma.cabangDinas.findUnique({ where: { id: cabangDinasId } }),
  ]);

  if (!laporan) {
    throw new AppError("Laporan tidak ditemukan", 404);
  }

  if (!cabang) {
    throw new AppError("Cabang dinas tidak ditemukan", 404);
  }

  const updated = await prisma.laporan.update({
    where: { id },
    data: {
      cabangDinasId,
      routingStatus: "manually_assigned",
      status: laporan.status === LaporanStatus.pending ? LaporanStatus.verified : laporan.status,
    },
    include: {
      kategori: { include: { dinas: true } },
      cabangDinas: { include: { dinas: true } },
      createdBy: { select: { id: true, name: true, email: true, image: true } },
    },
  });
  const voteMap = await getAdminReportVoteSummaries([updated.id]);
  return withReportVoteSummary(updated, voteMap);
}

export async function adminDeleteLaporan(id: string) {
  const laporan = await prisma.laporan.findUnique({ where: { id } });
  if (!laporan) {
    throw new AppError("Laporan tidak ditemukan", 404);
  }

  await prisma.laporan.delete({ where: { id } });
  return { id };
}

export async function removePetugasFromUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { petugas: true },
  });

  if (!user) {
    throw new AppError("User tidak ditemukan", 404);
  }

  if (!user.petugas) {
    throw new AppError("User ini belum terdaftar sebagai petugas", 400);
  }

  await prisma.petugasDinas.delete({ where: { userId } });

  if (user.role !== "admin") {
    await prisma.user.update({
      where: { id: userId },
      data: { role: "warga" },
    });
  }

  return { userId };
}
