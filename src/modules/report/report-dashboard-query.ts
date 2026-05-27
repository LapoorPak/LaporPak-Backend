import { prisma } from "../../config/db.js";
import { LaporanStatus, Prisma, Stsrc } from "../../generated/prisma/client.js";
import { AppError } from "../../middleware/authMiddleware.js";

export function combineReportWhere(
  ...conditions: Array<Prisma.TrLaporanWhereInput | null | undefined>
): Prisma.TrLaporanWhereInput {
  const filters = conditions.filter((condition): condition is Prisma.TrLaporanWhereInput => {
    if (!condition || typeof condition !== "object") {
      return false;
    }

    return Object.keys(condition).length > 0;
  });

  if (filters.length === 0) {
    return {};
  }

  if (filters.length === 1) {
    return filters[0];
  }

  return { AND: filters };
}

export function buildReportDashboardBaseWhere(input: {
  search?: string;
  dinasId?: string;
  cabangDinasId?: string;
  kategoriId?: string;
}): Prisma.TrLaporanWhereInput {
  const filters: Prisma.TrLaporanWhereInput[] = [
    { status: { not: LaporanStatus.rejected } },
    { stsrc: { not: Stsrc.D } },
  ];

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
        { kategori: { code: { contains: input.search, mode: "insensitive" } } },
        { kategori: { dinas: { name: { contains: input.search, mode: "insensitive" } } } },
        { kategori: { dinas: { short: { contains: input.search, mode: "insensitive" } } } },
        { cabangDinas: { name: { contains: input.search, mode: "insensitive" } } },
        { cabangDinas: { wilayah: { contains: input.search, mode: "insensitive" } } },
      ],
    });
  }

  return combineReportWhere(...filters);
}

export async function getReportDashboardSummary(where: Prisma.TrLaporanWhereInput) {
  const groupedByStatus = await prisma.trLaporan.groupBy({
    by: ["status"],
    where,
    _count: {
      _all: true,
    },
  });

  const counts = {
    pending: 0,
    verified: 0,
    in_progress: 0,
    clarification_requested: 0,
    resolved: 0,
    rejected: 0,
  };

  for (const entry of groupedByStatus) {
    counts[entry.status] = entry._count._all;
  }

  const laporanBaru = counts.pending + counts.verified;
  const diproses = counts.in_progress;
  const klarifikasi = counts.clarification_requested;
  const tuntas = counts.resolved;
  const totalTarget = laporanBaru + diproses + klarifikasi + tuntas;

  return {
    totalTarget,
    laporanBaru,
    diproses,
    klarifikasi,
    tuntas,
    byStatusRaw: counts,
  };
}

export async function getAgencyDashboardScope(input: {
  userId: string;
  role: string;
  scope?: "mine" | "all";
  requestedDinasId?: string;
  requestedCabangDinasId?: string;
}) {
  const isAdmin = input.role === "admin";
  let scopeDinasId = input.requestedDinasId;
  let scopeCabangDinasId = input.requestedCabangDinasId ?? null;

  const requestedCabang = input.requestedCabangDinasId
    ? await prisma.msCabangDinas.findFirst({
        where: { id: input.requestedCabangDinasId, stsrc: { not: Stsrc.D } },
        select: {
          id: true,
          name: true,
          wilayah: true,
          dinasId: true,
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
      })
    : null;

  if (input.requestedCabangDinasId && !requestedCabang) {
    throw new AppError("Cabang dinas tidak ditemukan", 404);
  }

  if (requestedCabang) {
    if (scopeDinasId && scopeDinasId !== requestedCabang.dinasId) {
      throw new AppError("cabangDinasId tidak sesuai dengan dinasId", 400);
    }

    scopeDinasId = requestedCabang.dinasId;
    scopeCabangDinasId = requestedCabang.id;
  }

  if (!isAdmin) {
    const officer = await prisma.msPetugasDinas.findUnique({
      where: { userId: input.userId },
      select: {
        cabangDinas: {
          select: {
            id: true,
            name: true,
            wilayah: true,
            dinasId: true,
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
        },
      },
    });

    if (!officer) {
      throw new AppError("Akun dinas belum terhubung ke cabang dinas", 403);
    }

    const officerDinasId = officer.cabangDinas.dinasId;
    if (scopeDinasId && scopeDinasId !== officerDinasId) {
      throw new AppError("Forbidden", 403);
    }

    if (requestedCabang && requestedCabang.dinasId !== officerDinasId) {
      throw new AppError("Forbidden", 403);
    }

    if (input.scope === "all" && !input.requestedDinasId && !input.requestedCabangDinasId) {
      return {
        dinasId: null,
        cabangDinasId: null,
        dinas: null,
        cabangDinas: null,
        officerDinasId,
        officerCabangDinas: {
          id: officer.cabangDinas.id,
          name: officer.cabangDinas.name,
          wilayah: officer.cabangDinas.wilayah,
        },
        isAdminScope: false,
      };
    }

    scopeDinasId = officerDinasId;
    scopeCabangDinasId = requestedCabang ? requestedCabang.id : null;

    return {
      dinasId: scopeDinasId,
      cabangDinasId: scopeCabangDinasId,
      dinas: requestedCabang?.dinas ?? officer.cabangDinas.dinas,
      cabangDinas: requestedCabang
        ? {
            id: requestedCabang.id,
            name: requestedCabang.name,
            wilayah: requestedCabang.wilayah,
          }
        : null,
      officerCabangDinas: {
        id: officer.cabangDinas.id,
        name: officer.cabangDinas.name,
        wilayah: officer.cabangDinas.wilayah,
      },
      officerDinasId,
      isAdminScope: false,
    };
  }

  if (!scopeDinasId) {
    throw new AppError("dinasId atau cabangDinasId wajib diisi untuk akun admin", 400);
  }

  const dinas =
    requestedCabang?.dinas ??
    (await prisma.msDinas.findFirst({
      where: { id: scopeDinasId, stsrc: { not: Stsrc.D } },
      select: {
        id: true,
        code: true,
        type: true,
        name: true,
        short: true,
      },
    }));

  if (!dinas) {
    throw new AppError("Dinas tidak ditemukan", 404);
  }

  return {
    dinasId: scopeDinasId,
    cabangDinasId: scopeCabangDinasId,
    dinas,
    cabangDinas: requestedCabang
      ? {
          id: requestedCabang.id,
          name: requestedCabang.name,
          wilayah: requestedCabang.wilayah,
        }
      : null,
    officerCabangDinas: null,
    officerDinasId: null,
    isAdminScope: true,
  };
}
