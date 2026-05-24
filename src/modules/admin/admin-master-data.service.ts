import { prisma } from "../../config/db.js";
import { Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../../middleware/authMiddleware.js";
import type {
  ListAdminCabangInput,
  ListAdminDinasInput,
  ListAdminKategoriInput,
} from "../../types/admin.js";

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
