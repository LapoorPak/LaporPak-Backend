import { prisma } from "../../config/db.js";
import { LaporanStatus, Prisma, Stsrc } from "../../generated/prisma/client.js";
import { AppError } from "../../middleware/authMiddleware.js";
import {
  citizenResolvedBroadcastNotification,
  newReportNotification,
  notifyCitizens,
  notifyReportOfficers,
} from "../notification/notification.service.js";
import { VALID_REPORT_STATUSES } from "../report/report-status.js";

type ReportVoteSummary = {
  upvotes: number;
  downvotes: number;
  voteScore: number;
};

const NONE_FILTER_VALUE = "__none";

type AdminReportSortInput = {
  sortBy?: string;
  sortDir?: "asc" | "desc";
};

function getReportSortDirection(direction?: AdminReportSortInput["sortDir"]) {
  return direction === "asc" ? "asc" : "desc";
}

function getAdminReportOrderBy(input: AdminReportSortInput): Prisma.TrLaporanOrderByWithRelationInput {
  const direction = getReportSortDirection(input.sortDir);

  switch (input.sortBy) {
    case "title":
    case "status":
    case "routingStatus":
    case "updatedAt":
    case "resolvedAt":
      return { [input.sortBy]: direction };
    case "kategori":
      return { kategori: { name: direction } };
    case "vote":
      return { votes: { _count: direction } };
    case "createdAt":
    default:
      return { createdAt: input.sortBy ? direction : "desc" };
  }
}

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

  const voteGroups = await prisma.trLaporanVote.groupBy({
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
  statusIds?: string[];
  dinasId?: string;
  dinasIds?: string[];
  cabangDinasId?: string;
  kategoriId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}) {
  const filters: Prisma.TrLaporanWhereInput[] = [{ stsrc: { not: Stsrc.D } }];

  const statusIds = input.statusIds?.length
    ? input.statusIds
    : input.status
      ? input.status.split(",").map((item) => item.trim()).filter(Boolean)
      : [];
  const validStatusIds = statusIds.filter((status) =>
    VALID_REPORT_STATUSES.includes(status as LaporanStatus),
  );

  if (statusIds.includes(NONE_FILTER_VALUE)) {
    filters.push({ id: NONE_FILTER_VALUE });
  } else if (validStatusIds.length > 0) {
    filters.push({ status: { in: validStatusIds as LaporanStatus[] } });
  }

  const dinasIds = input.dinasIds?.length
    ? input.dinasIds
    : input.dinasId
      ? [input.dinasId]
      : [];

  if (dinasIds.length > 0) {
    filters.push(
      dinasIds.includes(NONE_FILTER_VALUE)
        ? { id: NONE_FILTER_VALUE }
        : { kategori: { dinasId: { in: dinasIds } } },
    );
  }

  if (input.cabangDinasId) {
    filters.push({ cabangDinasId: input.cabangDinasId });
  }

  if (input.kategoriId) {
    filters.push({ kategoriId: input.kategoriId });
  }

  if (input.dateFrom || input.dateTo) {
    filters.push({
      createdAt: {
        ...(input.dateFrom ? { gte: input.dateFrom } : {}),
        ...(input.dateTo ? { lte: input.dateTo } : {}),
      },
    });
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

  return { AND: filters };
}

const adminReportListInclude = {
  kategori: { include: { dinas: { select: { id: true, code: true, name: true, short: true } } } },
  cabangDinas: { select: { id: true, name: true, wilayah: true, address: true, phone: true } },
  createdBy: { select: { id: true, name: true, email: true, image: true } },
  rating: true,
} satisfies Prisma.TrLaporanInclude;

const adminReportDetailInclude = {
  kategori: { include: { dinas: true } },
  cabangDinas: { include: { dinas: true } },
  createdBy: { select: { id: true, name: true, email: true, image: true } },
  assignedTo: { select: { id: true, name: true, email: true, image: true } },
  resolvedBy: { select: { id: true, name: true, email: true } },
} satisfies Prisma.TrLaporanInclude;

const adminReportMutationInclude = {
  kategori: { include: { dinas: true } },
  cabangDinas: { include: { dinas: true } },
  createdBy: { select: { id: true, name: true, email: true, image: true } },
} satisfies Prisma.TrLaporanInclude;

function getDayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getDayLabel(date: Date) {
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
  });
}

function getStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: "Pending",
    verified: "Terverifikasi",
    in_progress: "Diproses",
    clarification_requested: "Butuh Klarifikasi",
    resolved: "Selesai",
    rejected: "Ditolak",
  };

  return labels[status] ?? status;
}

function getRoutingLabel(status: string) {
  const labels: Record<string, string> = {
    pending: "Belum Dirouting",
    auto_assigned: "Auto Assign",
    manual_review: "Review Manual",
    manually_assigned: "Manual Assign",
    failed: "Gagal Routing",
  };

  return labels[status] ?? status;
}

function getReportActivityDateRange(input: {
  days?: number;
  dateFrom?: Date;
  dateTo?: Date;
}) {
  const hasCustomRange = Boolean(input.dateFrom || input.dateTo);
  const fallbackDays = Math.min(60, Math.max(7, Math.floor(input.days ?? 14)));
  const endDate = input.dateTo ? new Date(input.dateTo) : new Date();
  endDate.setHours(23, 59, 59, 999);

  const startDate = input.dateFrom ? new Date(input.dateFrom) : new Date(endDate);
  startDate.setHours(0, 0, 0, 0);

  if (!input.dateFrom) {
    startDate.setDate(startDate.getDate() - (fallbackDays - 1));
  }

  if (startDate > endDate) {
    const swappedStart = new Date(startDate);
    startDate.setTime(endDate.getTime());
    endDate.setTime(swappedStart.getTime());
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
  }

  const requestedDays =
    Math.floor((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1;
  const safeDays = hasCustomRange
    ? Math.min(60, Math.max(1, requestedDays))
    : fallbackDays;

  if (requestedDays > safeDays) {
    startDate.setTime(endDate.getTime());
    startDate.setHours(0, 0, 0, 0);
    startDate.setDate(startDate.getDate() - (safeDays - 1));
  }

  return { startDate, endDate, safeDays };
}

export async function getAdminReportActivity(input: {
  days?: number;
  search?: string;
  status?: string;
  statusIds?: string[];
  dinasIds?: string[];
  dateFrom?: Date;
  dateTo?: Date;
} = {}) {
  const { startDate, endDate, safeDays } = getReportActivityDateRange(input);
  const baseWhere = buildAdminReportWhere({
    ...input,
    dateFrom: startDate,
    dateTo: endDate,
  });

  const [
    periodReports,
    statusGroups,
    routingGroups,
    categoryGroups,
    aiGroups,
    totalReports,
    activeReports,
    resolvedReports,
    rejectedReports,
    manualReviewReports,
    resolvedDurations,
    ratings,
  ] = await Promise.all([
    prisma.trLaporan.findMany({
      where: baseWhere,
      select: {
        id: true,
        status: true,
        routingStatus: true,
        createdAt: true,
        resolvedAt: true,
        aiDecisionStatus: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.trLaporan.groupBy({
      by: ["status"],
      where: baseWhere,
      _count: { _all: true },
    }),
    prisma.trLaporan.groupBy({
      by: ["routingStatus"],
      where: baseWhere,
      _count: { _all: true },
    }),
    prisma.trLaporan.groupBy({
      by: ["kategoriId"],
      where: baseWhere,
      _count: { _all: true },
    }),
    prisma.trLaporan.groupBy({
      by: ["aiDecisionStatus"],
      where: baseWhere,
      _count: { _all: true },
    }),
    prisma.trLaporan.count({ where: baseWhere }),
    prisma.trLaporan.count({
      where: {
        ...baseWhere,
        status: {
          in: [
            LaporanStatus.pending,
            LaporanStatus.verified,
            LaporanStatus.in_progress,
            LaporanStatus.clarification_requested,
          ],
        },
      },
    }),
    prisma.trLaporan.count({
      where: { ...baseWhere, status: LaporanStatus.resolved },
    }),
    prisma.trLaporan.count({
      where: { ...baseWhere, status: LaporanStatus.rejected },
    }),
    prisma.trLaporan.count({
      where: { ...baseWhere, routingStatus: "manual_review" },
    }),
    prisma.trLaporan.findMany({
      where: {
        ...baseWhere,
        resolvedAt: { not: null },
      },
      select: { createdAt: true, resolvedAt: true },
    }),
    prisma.trLaporanRating.findMany({
      select: { score: true },
    }),
  ]);

  const buckets = Array.from({ length: safeDays }, (_, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);
    const key = getDayKey(date);

    return {
      date: key,
      label: getDayLabel(date),
      total: 0,
      resolved: 0,
      rejected: 0,
      active: 0,
      manualReview: 0,
    };
  });
  const bucketByDate = new Map(buckets.map((bucket) => [bucket.date, bucket]));

  periodReports.forEach((report) => {
    const bucket = bucketByDate.get(getDayKey(report.createdAt));
    if (!bucket) return;

    bucket.total += 1;
    if (report.status === LaporanStatus.resolved) bucket.resolved += 1;
    if (report.status === LaporanStatus.rejected) bucket.rejected += 1;
    if (report.routingStatus === "manual_review") bucket.manualReview += 1;
    if (
      report.status !== LaporanStatus.resolved &&
      report.status !== LaporanStatus.rejected
    ) {
      bucket.active += 1;
    }
  });

  const peak = buckets.reduce(
    (currentPeak, item) => (item.total > currentPeak.total ? item : currentPeak),
    buckets[0] ?? {
      date: getDayKey(startDate),
      label: getDayLabel(startDate),
      total: 0,
      resolved: 0,
      rejected: 0,
      active: 0,
      manualReview: 0,
    },
  );

  const categoryIds = categoryGroups
    .map((group) => group.kategoriId)
    .filter((id): id is string => Boolean(id));
  const categories = categoryIds.length > 0
    ? await prisma.msKategoriLaporan.findMany({
        where: { id: { in: categoryIds } },
        select: {
          id: true,
          name: true,
          dinasId: true,
          dinas: { select: { id: true, name: true, short: true } },
        },
      })
    : [];
  const categoryById = new Map(categories.map((category) => [category.id, category]));

  const topKategori = categoryGroups
    .filter((group) => group.kategoriId && categoryById.has(group.kategoriId))
    .map((group) => {
      const category = categoryById.get(group.kategoriId!)!;
      return {
        id: category.id,
        name: category.name,
        dinasName: category.dinas.name,
        total: group._count._all,
      };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const dinasMap = new Map<string, { id: string; name: string; short: string | null; total: number }>();
  categoryGroups.forEach((group) => {
    if (!group.kategoriId) return;
    const category = categoryById.get(group.kategoriId);
    if (!category) return;

    const current = dinasMap.get(category.dinas.id) ?? {
      id: category.dinas.id,
      name: category.dinas.name,
      short: category.dinas.short,
      total: 0,
    };
    current.total += group._count._all;
    dinasMap.set(category.dinas.id, current);
  });
  const topDinas = Array.from(dinasMap.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const averageResolutionHours =
    resolvedDurations.length > 0
      ? Math.round(
          resolvedDurations.reduce((sum, report) => {
            if (!report.resolvedAt) return sum;
            return sum + (report.resolvedAt.getTime() - report.createdAt.getTime()) / 36e5;
          }, 0) / resolvedDurations.length,
        )
      : 0;
  const averageRating =
    ratings.length > 0
      ? Number(
          (
            ratings.reduce((sum, rating) => sum + rating.score, 0) /
            ratings.length
          ).toFixed(1),
        )
      : 0;

  const aiAccepted =
    aiGroups.find((group) => group.aiDecisionStatus === "accepted")?._count._all ?? 0;
  const aiRejected =
    aiGroups.find((group) => group.aiDecisionStatus === "rejected")?._count._all ?? 0;

  return {
    days: safeDays,
    from: getDayKey(startDate),
    to: getDayKey(endDate),
    summary: {
      totalReports,
      newReports: periodReports.length,
      activeReports,
      resolvedReports,
      rejectedReports,
      manualReviewReports,
      averageDailyReports:
        buckets.length > 0
          ? Math.round(
              buckets.reduce((sum, item) => sum + item.total, 0) / buckets.length,
            )
          : 0,
      peakReports: peak.total,
      peakDate: peak.date,
      averageResolutionHours,
      averageRating,
      aiAccepted,
      aiRejected,
    },
    series: buckets,
    byStatus: statusGroups
      .map((group) => ({
        status: group.status,
        label: getStatusLabel(group.status),
        total: group._count._all,
      }))
      .sort((a, b) => b.total - a.total),
    routing: routingGroups
      .map((group) => ({
        status: group.routingStatus,
        label: getRoutingLabel(group.routingStatus),
        total: group._count._all,
      }))
      .sort((a, b) => b.total - a.total),
    topDinas,
    topKategori,
  };
}

export async function listAdminLaporan(input: {
  pagination: { skip: number; take: number };
  search?: string;
  status?: string;
  statusIds?: string[];
  dinasId?: string;
  dinasIds?: string[];
  cabangDinasId?: string;
  kategoriId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}) {
  const where = buildAdminReportWhere(input);

  const [data, total] = await Promise.all([
    prisma.trLaporan.findMany({
      where,
      orderBy: getAdminReportOrderBy(input),
      skip: input.pagination.skip,
      take: input.pagination.take,
      include: adminReportListInclude,
    }),
    prisma.trLaporan.count({ where }),
  ]);

  const voteMap = await getAdminReportVoteSummaries(data.map((laporan) => laporan.id));

  return {
    data: data.map((laporan) => withReportVoteSummary(laporan, voteMap)),
    total,
  };
}

export async function getAdminLaporanDetail(id: string) {
  const laporan = await prisma.trLaporan.findFirst({
    where: { id, stsrc: { not: Stsrc.D } },
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
  const laporan = await prisma.trLaporan.findFirst({
    where: { id: input.id, stsrc: { not: Stsrc.D } },
  });
  if (!laporan) {
    throw new AppError("Laporan tidak ditemukan", 404);
  }

  if (!VALID_REPORT_STATUSES.includes(input.status as LaporanStatus)) {
    throw new AppError(
      `Status tidak valid. Harus salah satu dari: ${VALID_REPORT_STATUSES.join(", ")}`,
      400,
    );
  }

  const updated = await prisma.trLaporan.update({
    where: { id: input.id },
    data: {
      status: input.status as LaporanStatus,
      stsrc: Stsrc.U,
      ...(input.agencyNote !== undefined ? { agencyNote: input.agencyNote } : {}),
      ...(input.resolutionNote !== undefined ? { resolutionNote: input.resolutionNote } : {}),
      resolvedAt: input.status === LaporanStatus.resolved ? new Date() : undefined,
      resolvedById: input.status === LaporanStatus.resolved ? input.adminUserId : undefined,
    },
    include: adminReportMutationInclude,
  });
  if (updated.status === LaporanStatus.resolved) {
    const dinasName =
      updated.kategori?.dinas?.name ||
      updated.cabangDinas?.dinas?.name ||
      "Dinas";

    notifyCitizens(
      citizenResolvedBroadcastNotification(updated.title, updated.id, dinasName, {
        resolutionNote: updated.resolutionNote ?? updated.agencyNote,
        imageUrl: updated.resolutionImages[0] ?? updated.images[0] ?? null,
        reporterUserId: updated.createdById,
      }),
    ).catch((error) =>
      console.error("[notification] citizen resolved broadcast failed:", error),
    );
  }

  const voteMap = await getAdminReportVoteSummaries([updated.id]);
  return withReportVoteSummary(updated, voteMap);
}

export async function adminAssignLaporan(id: string, cabangDinasId: string) {
  const [laporan, cabang] = await Promise.all([
    prisma.trLaporan.findFirst({
      where: { id, stsrc: { not: Stsrc.D } },
      include: { kategori: true },
    }),
    prisma.msCabangDinas.findFirst({
      where: { id: cabangDinasId, stsrc: { not: Stsrc.D } },
    }),
  ]);

  if (!laporan) {
    throw new AppError("Laporan tidak ditemukan", 404);
  }

  if (!cabang) {
    throw new AppError("Cabang dinas tidak ditemukan", 404);
  }

  const updated = await prisma.trLaporan.update({
    where: { id },
    data: {
      cabangDinasId,
      routingStatus: "manually_assigned",
      stsrc: Stsrc.U,
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
  const laporan = await prisma.trLaporan.findFirst({
    where: { id, stsrc: { not: Stsrc.D } },
  });
  if (!laporan) {
    throw new AppError("Laporan tidak ditemukan", 404);
  }

  await prisma.trLaporan.update({
    where: { id },
    data: { stsrc: Stsrc.D },
  });
  return { id };
}
