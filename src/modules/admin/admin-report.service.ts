import { prisma } from "../../config/db.js";
import { LaporanStatus, Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../../middleware/authMiddleware.js";
import {
  newReportNotification,
  notifyReportOfficers,
} from "../notification/notification.service.js";
import { VALID_REPORT_STATUSES } from "../report/report-status.js";

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

function withReportVoteSummary<T extends { id: string }>(
  report: T,
  voteMap: Map<string, ReportVoteSummary>,
) {
  return {
    ...report,
    ...(voteMap.get(report.id) ?? emptyReportVoteSummary()),
  };
}

function buildAdminReportWhere(input: {
  search?: string;
  status?: string;
  dinasId?: string;
  cabangDinasId?: string;
  kategoriId?: string;
}) {
  const filters: Prisma.LaporanWhereInput[] = [];

  if (input.status && VALID_REPORT_STATUSES.includes(input.status as LaporanStatus)) {
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

  return filters.length > 0 ? { AND: filters } : {};
}

const adminReportListInclude = {
  kategori: { include: { dinas: { select: { id: true, code: true, name: true, short: true } } } },
  cabangDinas: { select: { id: true, name: true, wilayah: true } },
  createdBy: { select: { id: true, name: true, email: true, image: true } },
} satisfies Prisma.LaporanInclude;

const adminReportDetailInclude = {
  kategori: { include: { dinas: true } },
  cabangDinas: { include: { dinas: true } },
  createdBy: { select: { id: true, name: true, email: true, image: true } },
  assignedTo: { select: { id: true, name: true, email: true, image: true } },
  resolvedBy: { select: { id: true, name: true, email: true } },
} satisfies Prisma.LaporanInclude;

const adminReportMutationInclude = {
  kategori: { include: { dinas: true } },
  cabangDinas: { include: { dinas: true } },
  createdBy: { select: { id: true, name: true, email: true, image: true } },
} satisfies Prisma.LaporanInclude;

export async function listAdminLaporan(input: {
  pagination: { skip: number; take: number };
  search?: string;
  status?: string;
  dinasId?: string;
  cabangDinasId?: string;
  kategoriId?: string;
}) {
  const where = buildAdminReportWhere(input);

  const [data, total] = await Promise.all([
    prisma.laporan.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: input.pagination.skip,
      take: input.pagination.take,
      include: adminReportListInclude,
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
    include: adminReportDetailInclude,
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

  if (!VALID_REPORT_STATUSES.includes(input.status as LaporanStatus)) {
    throw new AppError(
      `Status tidak valid. Harus salah satu dari: ${VALID_REPORT_STATUSES.join(", ")}`,
      400,
    );
  }

  const updated = await prisma.laporan.update({
    where: { id: input.id },
    data: {
      status: input.status as LaporanStatus,
      ...(input.agencyNote !== undefined ? { agencyNote: input.agencyNote } : {}),
      ...(input.resolutionNote !== undefined ? { resolutionNote: input.resolutionNote } : {}),
      resolvedAt: input.status === LaporanStatus.resolved ? new Date() : undefined,
      resolvedById: input.status === LaporanStatus.resolved ? input.adminUserId : undefined,
    },
    include: adminReportMutationInclude,
  });
  const voteMap = await getAdminReportVoteSummaries([updated.id]);
  return withReportVoteSummary(updated, voteMap);
}

export async function adminAssignLaporan(id: string, cabangDinasId: string) {
  const [laporan, cabang] = await Promise.all([
    prisma.laporan.findUnique({
      where: { id },
      include: { kategori: true },
    }),
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
    include: adminReportMutationInclude,
  });
  const voteMap = await getAdminReportVoteSummaries([updated.id]);
  notifyReportOfficers({
    dinasId: cabang.dinasId,
    cabangDinasId,
    data: newReportNotification(
      updated.title,
      updated.id,
      laporan.kategori?.name ?? "Laporan",
    ),
  }).catch((error) => console.error("[notification] assign notify failed:", error));

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
