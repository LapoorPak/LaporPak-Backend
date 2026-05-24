import { prisma } from "../../config/db.js";
import { LaporanStatus, Prisma, Stsrc } from "../../generated/prisma/client.js";
import {
  getReportFeedback,
  getReportFeedbackByIds,
} from "./report-feedback.js";
import {
  buildPersistedAiReview,
  buildReporterPayload,
  buildTimelinePayload,
} from "./report-presenter.js";

export async function getReportStats(where: Prisma.LaporanWhereInput) {
  const [groupedByStatus, groupedByCategory] = await Promise.all([
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
        where: { id: { in: categoryIds }, stsrc: { not: Stsrc.D } },
        select: { id: true, code: true, name: true },
      })
    : [];
  const categoryMap = new Map(categories.map((category) => [category.id, category]));

  return {
    byStatus: groupedByStatus.map((entry) => ({
      status: entry.status,
      total: entry._count._all,
    })),
    byCategory: groupedByCategory.map((entry) => ({
      kategoriId: entry.kategoriId,
      kategoriCode: entry.kategoriId ? categoryMap.get(entry.kategoriId)?.code ?? null : null,
      kategoriName: entry.kategoriId ? categoryMap.get(entry.kategoriId)?.name ?? null : null,
      total: entry._count._all,
    })),
  };
}

export function buildReportLocationWhere(input: {
  status?: LaporanStatus;
  kategoriId?: string;
  dinasId?: string;
  cabangDinasId?: string;
  createdById?: string;
  search?: string;
  minLat?: number;
  maxLat?: number;
  minLng?: number;
  maxLng?: number;
  excludeRejected?: boolean;
}): Prisma.LaporanWhereInput {
  const filters: Prisma.LaporanWhereInput[] = [{ stsrc: { not: Stsrc.D } }];

  if (input.excludeRejected) {
    filters.push({ status: { not: LaporanStatus.rejected } });
  }

  if (input.status) {
    filters.push({ status: input.status });
  }

  if (input.kategoriId) {
    filters.push({ kategoriId: input.kategoriId });
  }

  if (input.dinasId) {
    filters.push({ kategori: { dinasId: input.dinasId } });
  }

  if (input.cabangDinasId) {
    filters.push({ cabangDinasId: input.cabangDinasId });
  }

  if (input.createdById) {
    filters.push({ createdById: input.createdById });
  }

  if (input.search) {
    filters.push({
      OR: [
        { title: { contains: input.search, mode: "insensitive" } },
        { description: { contains: input.search, mode: "insensitive" } },
        { address: { contains: input.search, mode: "insensitive" } },
        { kategori: { name: { contains: input.search, mode: "insensitive" } } },
        { kategori: { code: { contains: input.search, mode: "insensitive" } } },
      ],
    });
  }

  if (input.minLat != null || input.maxLat != null) {
    filters.push({
      latitude: {
        ...(input.minLat != null ? { gte: input.minLat } : {}),
        ...(input.maxLat != null ? { lte: input.maxLat } : {}),
      },
    });
  }

  if (input.minLng != null || input.maxLng != null) {
    filters.push({
      longitude: {
        ...(input.minLng != null ? { gte: input.minLng } : {}),
        ...(input.maxLng != null ? { lte: input.maxLng } : {}),
      },
    });
  }

  return { AND: filters };
}

export async function getReportLocationPayload(
  where: Prisma.LaporanWhereInput,
  viewer?: {
    role?: string;
    dinasId?: string | null;
    cabangDinasId?: string | null;
    userId?: string | null;
  },
  options?: { pagination?: { skip: number; take: number }; sort?: string },
) {
  const reportLocationSelect = {
    id: true,
    title: true,
    agencyNote: true,
    resolutionNote: true,
    resolutionImages: true,
    images: true,
    latitude: true,
    longitude: true,
    status: true,
    routingStatus: true,
    aiDecisionStatus: true,
    aiRejectionCode: true,
    aiSuggestedRewrite: true,
    aiClarityScore: true,
    aiSeriousnessScore: true,
    aiUrgencyScore: true,
    aiConfidence: true,
    aiReasoning: true,
    createdAt: true,
    updatedAt: true,
    createdBy: { select: { id: true, name: true } },
    kategori: {
      select: {
        id: true,
        code: true,
        name: true,
        dinas: {
          select: {
            id: true,
            code: true,
            type: true,
            name: true,
          },
        },
      },
    },
    cabangDinas: {
      select: {
        id: true,
        name: true,
        wilayah: true,
      },
    },
    timeline: {
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        status: true,
        note: true,
        images: true,
        actorRole: true,
        createdAt: true,
      },
    },
  } satisfies Prisma.LaporanSelect;

  if (options?.sort === "top") {
    const [candidates, total, stats] = await Promise.all([
      prisma.laporan.findMany({
        where,
        select: { id: true, createdAt: true },
      }),
      prisma.laporan.count({ where }),
      getReportStats(where),
    ]);
    const feedbackMap = await getReportFeedbackByIds(
      candidates.map((report) => report.id),
      viewer?.userId,
    );
    const sortedIds = candidates
      .sort((a, b) => {
        const aFeedback = getReportFeedback(feedbackMap, a.id);
        const bFeedback = getReportFeedback(feedbackMap, b.id);

        return (
          bFeedback.voteScore - aFeedback.voteScore ||
          bFeedback.upvotes - aFeedback.upvotes ||
          b.createdAt.getTime() - a.createdAt.getTime()
        );
      })
      .map((report) => report.id);
    const pagedIds = options.pagination
      ? sortedIds.slice(options.pagination.skip, options.pagination.skip + options.pagination.take)
      : sortedIds;
    const pageReports = pagedIds.length > 0
      ? await prisma.laporan.findMany({
          where: { id: { in: pagedIds } },
          select: reportLocationSelect,
        })
      : [];
    const reportById = new Map(pageReports.map((report) => [report.id, report]));
    const reports = pagedIds
      .map((id) => reportById.get(id))
      .filter((report): report is NonNullable<typeof report> => Boolean(report));

    return {
      data: reports.map((report) => {
        const feedback = getReportFeedback(feedbackMap, report.id);
        const isOwnCitizenReport = Boolean(viewer?.userId && report.createdBy?.id === viewer.userId);
        const isScopedAgencyReport =
          viewer?.role === "admin" ||
          Boolean(viewer?.dinasId && report.kategori?.dinas?.id === viewer.dinasId) ||
          Boolean(viewer?.cabangDinasId && report.cabangDinas?.id === viewer.cabangDinasId);

        return {
          id: report.id,
          title: report.title,
          agencyNote: report.agencyNote,
          resolutionNote: report.resolutionNote ?? null,
          resolutionImages: report.resolutionImages ?? [],
          images: report.images ?? [],
          lat: report.latitude,
          lng: report.longitude,
          status: report.status,
          routingStatus: report.routingStatus,
          urgencyScore: report.aiUrgencyScore,
          createdAt: report.createdAt,
          updatedAt: report.updatedAt,
          createdBy: buildReporterPayload(report.createdBy, viewer),
          kategori: report.kategori,
          dinas: report.kategori?.dinas ?? null,
          cabangDinas: report.cabangDinas,
          canEdit: isOwnCitizenReport || isScopedAgencyReport,
          ownership: isOwnCitizenReport || isScopedAgencyReport ? "mine" : "other",
          timeline: buildTimelinePayload(report.timeline),
          aiReview: buildPersistedAiReview(report),
          ...feedback,
        };
      }),
      total,
      stats,
    };
  }

  const [reports, total, stats] = await Promise.all([
    prisma.laporan.findMany({
      where,
      select: reportLocationSelect,
      orderBy: { createdAt: "desc" },
      ...(options?.pagination ? { skip: options.pagination.skip, take: options.pagination.take } : {}),
    }),
    prisma.laporan.count({ where }),
    getReportStats(where),
  ]);
  const feedbackMap = await getReportFeedbackByIds(
    reports.map((report) => report.id),
    viewer?.userId,
  );

  return {
    data: reports.map((report) => {
      const feedback = getReportFeedback(feedbackMap, report.id);
      const isOwnCitizenReport = Boolean(viewer?.userId && report.createdBy?.id === viewer.userId);
      const isScopedAgencyReport =
        viewer?.role === "admin" ||
        Boolean(viewer?.dinasId && report.kategori?.dinas?.id === viewer.dinasId) ||
        Boolean(viewer?.cabangDinasId && report.cabangDinas?.id === viewer.cabangDinasId);

      return {
        id: report.id,
        title: report.title,
        agencyNote: report.agencyNote,
        resolutionNote: report.resolutionNote ?? null,
        resolutionImages: report.resolutionImages ?? [],
        images: report.images ?? [],
        lat: report.latitude,
        lng: report.longitude,
        status: report.status,
        routingStatus: report.routingStatus,
        urgencyScore: report.aiUrgencyScore,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt,
        createdBy: buildReporterPayload(report.createdBy, viewer),
        kategori: report.kategori,
        dinas: report.kategori?.dinas ?? null,
        cabangDinas: report.cabangDinas,
        canEdit: isOwnCitizenReport || isScopedAgencyReport,
        ownership: isOwnCitizenReport || isScopedAgencyReport ? "mine" : "other",
        timeline: buildTimelinePayload(report.timeline),
        aiReview: buildPersistedAiReview(report),
        ...feedback,
      };
    }),
    total,
    stats,
  };
}
