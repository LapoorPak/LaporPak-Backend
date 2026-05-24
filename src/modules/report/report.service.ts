import { prisma } from "../../config/db.js";
import { LaporanStatus, Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../../middleware/authMiddleware.js";
import {
  aiRejectedReportNotification,
  citizenClarificationNotification,
  citizenStatusNotification,
  newReportNotification,
  notifyCabangOfficers,
  notifyUser,
  officerStatusNotification,
} from "../notification/notification.service.js";
import { analyzeReportSubmission, getDinasTypeForCategory } from "./report-ai.service.js";
import { resolveCabangDinas } from "./report-routing.service.js";
import {
  assertReportEditableByUser,
  getReportOrThrow,
} from "./report-access.js";
import {
  buildReportDashboardBaseWhere,
  combineReportWhere,
  getAgencyDashboardScope,
  getReportDashboardSummary,
} from "./report-dashboard-query.js";
import {
  buildReportLocationWhere,
  getReportLocationPayload,
  getReportStats,
} from "./report-location-query.js";
import {
  buildRoutingMeta,
  buildUnavailableAiAnalysis,
  computeUrgencyScore,
  createRoutingDecision,
} from "./report-creation-support.js";
import {
  getReportFeedback,
  getReportFeedbackByIds,
} from "./report-feedback.js";
import {
  buildTimelineEntry,
  normalizeImagePaths,
  normalizeOptionalText,
  normalizeRatingScore,
  normalizeVoteValue,
} from "./report-inputs.js";
import {
  buildAiReview,
  buildPersistedAiReview,
  getImageInputHint,
  buildReporterPayload,
  buildTimelinePayload,
} from "./report-presenter.js";
import {
  DASHBOARD_DATE_FORMATTER,
  buildReportDashboardTabWhere,
  getDashboardStatusPresentation,
  requireReportStatus,
  resolveDashboardTab,
  validateReportStatus,
} from "./report-status.js";
import type {
  CreateReportInput,
  GetReportDashboardInput,
  ListMyReportsInput,
  ListReportLocationsInput,
  ListReportsInput,
  RateReportInput,
  ResolveReportInput,
  ResolvedKategori,
  SubmitReportClarificationInput,
  UpdateReportStatusInput,
  VoteReportInput,
} from "../../types/report.js";

type ReportAiAnalysis = Awaited<ReturnType<typeof analyzeReportSubmission>>;
type RoutingResolution = Awaited<ReturnType<typeof resolveCabangDinas>>;

const reportCreateInclude = {
  kategori: { include: { dinas: true } },
  cabangDinas: { include: { dinas: true } },
  createdBy: { select: { id: true, name: true, image: true } },
  timeline: { orderBy: { createdAt: "asc" } },
} satisfies Prisma.LaporanInclude;

const reportDetailInclude = {
  kategori: { include: { dinas: true } },
  cabangDinas: { include: { dinas: true } },
  createdBy: { select: { id: true, name: true, image: true } },
  assignedTo: { select: { id: true, name: true, image: true } },
  timeline: { orderBy: { createdAt: "asc" } },
} satisfies Prisma.LaporanInclude;

async function createRejectedReportResult(input: {
  title: string;
  description: string;
  kategoriId: string | null;
  address?: string;
  latitude: number;
  longitude: number;
  createdById: string;
  analysis: ReportAiAnalysis;
}) {
  const rejectedReport = await prisma.laporan.create({
    data: {
      title: input.title,
      description: input.description,
      status: "rejected",
      routingStatus: "failed",
      kategoriId: input.kategoriId,
      latitude: input.latitude,
      longitude: input.longitude,
      address: input.address || null,
      images: input.analysis.acceptedImagePaths,
      createdById: input.createdById,
      aiDecisionStatus: "rejected",
      aiRejectionCode: input.analysis.rejectionCode,
      aiSuggestedRewrite: input.analysis.suggestedRewrite,
      aiClarityScore: input.analysis.clarityScore,
      aiSeriousnessScore: input.analysis.seriousnessScore,
      aiConfidence: input.analysis.confidence,
      aiReasoning: input.analysis.rejectionReason ?? input.analysis.reasoning,
      aiClassified: false,
      aiRouteMeta: {
        statusAi: "ditolak",
        alasanAi: input.analysis.rejectionReason,
        saranPerbaikanAi: input.analysis.suggestedRewrite,
        gambarDiabaikanAi: input.analysis.ignoredImagePaths,
        petunjukGambarAi: getImageInputHint(input.analysis.ignoredImagePaths),
      } as Prisma.InputJsonValue,
      timeline: {
        create: buildTimelineEntry({
          status: LaporanStatus.rejected,
          note: input.analysis.rejectionReason ?? input.analysis.reasoning,
          images: input.analysis.acceptedImagePaths,
          actorId: null,
          actorRole: "ai",
        }),
      },
    },
    include: reportCreateInclude,
  });

  const rejectionReason =
    input.analysis.rejectionReason || "Laporan ditolak AI karena belum cukup jelas untuk diproses.";

  notifyUser({
    userId: input.createdById,
    ...aiRejectedReportNotification(input.title, rejectedReport.id, rejectionReason),
  }).catch((error) => console.error("[notification] ai reject notify failed:", error));

  return {
    ...rejectedReport,
    timeline: buildTimelinePayload(rejectedReport.timeline),
    aiReview: buildAiReview({
      accepted: false,
      confidence: input.analysis.confidence,
      reasoning: input.analysis.reasoning,
      clarityScore: input.analysis.clarityScore,
      seriousnessScore: input.analysis.seriousnessScore,
      acceptedImagePaths: input.analysis.acceptedImagePaths,
      ignoredImagePaths: input.analysis.ignoredImagePaths,
      rejectionCode: input.analysis.rejectionCode,
      rejectionReason: input.analysis.rejectionReason,
      suggestedRewrite: input.analysis.suggestedRewrite,
    }),
  };
}

export async function listReports(input: ListReportsInput) {
  const status = validateReportStatus(input.status);
  const where: Prisma.LaporanWhereInput = {
    ...(status ? { status } : {}),
    ...(input.kategoriId ? { kategoriId: input.kategoriId } : {}),
    ...(input.search ? { title: { contains: input.search, mode: "insensitive" } } : {}),
  };

  const [laporan, total, stats] = await Promise.all([
    prisma.laporan.findMany({
      where,
      include: {
        kategori: { include: { dinas: true } },
        cabangDinas: { include: { dinas: true } },
        createdBy: { select: { id: true, name: true, image: true } },
        timeline: { orderBy: { createdAt: "asc" } },
      },
      orderBy: { createdAt: "desc" },
      skip: input.pagination.skip,
      take: input.pagination.take,
    }),
    prisma.laporan.count({ where }),
    getReportStats(where),
  ]);
  const feedbackMap = await getReportFeedbackByIds(laporan.map((item) => item.id));

  return {
    data: laporan.map((item) => ({
      ...item,
      createdBy: buildReporterPayload(item.createdBy),
      timeline: buildTimelinePayload(item.timeline),
      aiReview: buildPersistedAiReview(item),
      ...getReportFeedback(feedbackMap, item.id),
    })),
    total,
    stats,
  };
}

export async function listMyReports(input: ListMyReportsInput) {
  const status = validateReportStatus(input.status);
  const where: Prisma.LaporanWhereInput = {
    createdById: input.userId,
    ...(status ? { status } : {}),
    ...(input.kategoriId ? { kategoriId: input.kategoriId } : {}),
    ...(input.search ? { title: { contains: input.search, mode: "insensitive" } } : {}),
  };

  const [laporan, total, stats] = await Promise.all([
    prisma.laporan.findMany({
      where,
      include: {
        kategori: { include: { dinas: true } },
        cabangDinas: { include: { dinas: true } },
        timeline: { orderBy: { createdAt: "asc" } },
      },
      orderBy: { createdAt: "desc" },
      skip: input.pagination.skip,
      take: input.pagination.take,
    }),
    prisma.laporan.count({ where }),
    getReportStats(where),
  ]);
  const feedbackMap = await getReportFeedbackByIds(
    laporan.map((item) => item.id),
    input.userId,
  );

  return {
    data: laporan.map((item) => ({
      ...item,
      timeline: buildTimelinePayload(item.timeline),
      aiReview: buildPersistedAiReview(item),
      ...getReportFeedback(feedbackMap, item.id),
    })),
    total,
    stats,
  };
}

export async function listReportLocations(input: ListReportLocationsInput) {
  let scopedDinasId = input.dinasId;
  let viewerDinasId: string | null = null;

  if (input.scope && input.role && input.role !== "warga" && input.role !== "admin") {
    if (!input.userId) {
      throw new AppError("Unauthorized", 401);
    }

    const officer = await prisma.petugasDinas.findUnique({
      where: { userId: input.userId },
      select: { cabangDinas: { select: { dinasId: true } } },
    });

    if (!officer) {
      throw new AppError("Akun dinas belum terhubung ke cabang dinas", 403);
    }

    viewerDinasId = officer.cabangDinas.dinasId;
    scopedDinasId = viewerDinasId;
  } else if (input.role === "admin") {
    viewerDinasId = input.dinasId ?? null;
  }

  const where = buildReportLocationWhere({
    status: validateReportStatus(input.status),
    kategoriId: input.kategoriId,
    dinasId: scopedDinasId,
    cabangDinasId: input.cabangDinasId,
    createdById: input.createdById,
    search: input.search,
    minLat: input.minLat,
    maxLat: input.maxLat,
    minLng: input.minLng,
    maxLng: input.maxLng,
    excludeRejected: true,
  });

  return getReportLocationPayload(where, {
    role: input.role,
    dinasId: viewerDinasId,
    userId: input.userId,
  }, {
    pagination: input.pagination,
    sort: input.sort,
  });
}

export async function getReportDashboard(input: GetReportDashboardInput) {
  const activeTab = resolveDashboardTab(input.tab);
  const scope = await getAgencyDashboardScope({
    userId: input.userId,
    role: input.role,
    requestedDinasId: input.requestedDinasId,
    requestedCabangDinasId: input.requestedCabangDinasId,
  });
  const baseWhere = buildReportDashboardBaseWhere({
    search: input.search,
    dinasId: scope.dinasId,
    cabangDinasId: scope.cabangDinasId ?? undefined,
    kategoriId: input.kategoriId,
  });
  const listWhere = combineReportWhere(baseWhere, buildReportDashboardTabWhere(activeTab));

  const [reports, total, summary] = await Promise.all([
    prisma.laporan.findMany({
      where: listWhere,
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
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
                short: true,
              },
            },
          },
        },
        cabangDinas: {
          select: {
            id: true,
            name: true,
            wilayah: true,
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
      orderBy: { createdAt: "desc" },
      skip: input.pagination.skip,
      take: input.pagination.take,
    }),
    prisma.laporan.count({ where: listWhere }),
    getReportDashboardSummary(baseWhere),
  ]);

  return {
    data: reports.map((report) => {
      const presentation = getDashboardStatusPresentation(report.status);
      const dinas = report.cabangDinas?.dinas ?? report.kategori?.dinas ?? null;
      const instansiName =
        report.cabangDinas?.name || dinas?.short || dinas?.name || "Belum ditugaskan";

      return {
        id: report.id,
        referenceCode: `#${report.id.slice(0, 8)}`,
        title: report.title,
        status: report.status,
        statusLabel: presentation.label,
        statusTone: presentation.tone,
        dashboardGroup: presentation.group,
        date: report.createdAt,
        dateLabel: DASHBOARD_DATE_FORMATTER.format(report.createdAt),
        agencyName: instansiName,
        dinas: dinas
          ? {
              id: dinas.id,
              code: dinas.code,
              type: dinas.type,
              name: dinas.name,
              short: dinas.short,
            }
          : null,
        cabangDinas: report.cabangDinas
          ? {
              id: report.cabangDinas.id,
              name: report.cabangDinas.name,
              wilayah: report.cabangDinas.wilayah,
            }
          : null,
        kategori: report.kategori
          ? {
              id: report.kategori.id,
              code: report.kategori.code,
              name: report.kategori.name,
            }
          : null,
      };
    }),
    total,
    stats: {
      activeTab,
      summary,
      scope: {
        dinas: scope.dinas,
        cabangDinas: scope.cabangDinas,
        officerCabangDinas: scope.officerCabangDinas,
        isAdminScope: scope.isAdminScope,
      },
      tabs: [
        { key: "semua", label: "Semua", total: summary.totalTarget },
        { key: "baru", label: "Baru", total: summary.laporanBaru },
        { key: "diproses", label: "Diproses", total: summary.diproses },
        { key: "klarifikasi", label: "Klarifikasi", total: summary.klarifikasi },
        { key: "tuntas", label: "Tuntas", total: summary.tuntas },
      ],
    },
  };
}

export async function createReport(input: CreateReportInput) {
  if (!input.title || !input.description || input.latitude == null || input.longitude == null) {
    throw new AppError("title, description, latitude, and longitude are required", 400);
  }

  const latitudeValue = Number(input.latitude);
  const longitudeValue = Number(input.longitude);
  const imagePaths = Array.isArray(input.imagePaths)
    ? input.imagePaths.filter((image): image is string => typeof image === "string")
    : [];

  let analysis: ReportAiAnalysis;

  try {
    analysis = await analyzeReportSubmission({
      title: input.title,
      description: input.description,
      imagePaths,
      imageFiles: input.aiImages,
    });
  } catch (error) {
    console.error("[report-ai] error:", error);
    analysis = buildUnavailableAiAnalysis({
      acceptedImagePaths: imagePaths,
      ignoredImagePaths: [],
    });
  }

  const manualKategori = input.kategoriId
    ? await prisma.kategoriLaporan.findUnique({
        where: { id: input.kategoriId },
        include: { dinas: true },
      })
    : null;

  if (input.kategoriId && !manualKategori) {
    throw new AppError("Invalid kategoriId", 400);
  }

  if (!analysis.accepted) {
    return createRejectedReportResult({
      title: input.title,
      description: input.description,
      kategoriId: manualKategori?.id ?? null,
      address: input.address,
      latitude: latitudeValue,
      longitude: longitudeValue,
      createdById: input.createdById,
      analysis,
    });
  }

  let resolvedKategori: ResolvedKategori | null = null;
  let dinasType: string | undefined;
  let aiConfidence: number | null = analysis.confidence;
  let aiReasoning: string | null = analysis.reasoning;
  let aiClassified = !input.kategoriId;

  if (input.kategoriId) {
    resolvedKategori = manualKategori;
    dinasType = manualKategori!.dinas.type || manualKategori!.dinas.code;
  } else {
    if (!analysis.categoryCode) {
      analysis = {
        ...analysis,
        accepted: false,
        rejectionCode: analysis.rejectionCode ?? "kategori_tidak_ditemukan",
        rejectionReason:
          analysis.rejectionReason ??
          "AI wrapper tidak dapat menentukan kategori laporan secara aman.",
        suggestedRewrite:
          analysis.suggestedRewrite ??
          "Perjelas objek yang bermasalah, lokasi, dan dampaknya, atau pilih kategori manual bila tersedia.",
        categoryCode: null,
      };
    }

    if (!analysis.accepted) {
      return createRejectedReportResult({
        title: input.title,
        description: input.description,
        kategoriId: null,
        address: input.address,
        latitude: latitudeValue,
        longitude: longitudeValue,
        createdById: input.createdById,
        analysis,
      });
    }

    const kategori = await prisma.kategoriLaporan.findUnique({
      where: { code: analysis.categoryCode! },
      include: { dinas: true },
    });

    if (!kategori) {
      analysis = {
        ...analysis,
        accepted: false,
        rejectionCode: "kategori_tidak_dikenal",
        rejectionReason: "AI wrapper mengembalikan kategori yang tidak dikenal.",
        suggestedRewrite:
          "Silakan kirim ulang laporan atau pilih kategori manual yang paling sesuai.",
        categoryCode: null,
      };

      return createRejectedReportResult({
        title: input.title,
        description: input.description,
        kategoriId: null,
        address: input.address,
        latitude: latitudeValue,
        longitude: longitudeValue,
        createdById: input.createdById,
        analysis,
      });
    }

    resolvedKategori = kategori;
    dinasType = kategori.dinas.type || kategori.dinas.code || getDinasTypeForCategory(analysis.categoryCode!);
  }

  let routing: RoutingResolution | null = null;
  if (dinasType) {
    routing = await resolveCabangDinas({
      dinasType,
      latitude: latitudeValue,
      longitude: longitudeValue,
    });
  }

  const urgencyScore = computeUrgencyScore(resolvedKategori?.urgencyWeight ?? 50, aiConfidence);
  const suggestedSlaHours = resolvedKategori?.slaHours ?? null;

  const laporan = await prisma.laporan.create({
    data: {
      title: input.title,
      description: input.description,
      status: LaporanStatus.verified,
      kategoriId: resolvedKategori!.id,
      cabangDinasId: routing?.assignedCabang?.id ?? null,
      latitude: latitudeValue,
      longitude: longitudeValue,
      address: input.address || null,
      images: analysis.acceptedImagePaths,
      createdById: input.createdById,
      routingStatus: routing?.routingStatus ?? "manual_review",
      aiDecisionStatus: "accepted",
      aiRejectionCode: null,
      aiSuggestedRewrite: null,
      aiClarityScore: analysis.clarityScore,
      aiSeriousnessScore: analysis.seriousnessScore,
      aiConfidence,
      aiReasoning,
      aiClassified,
      aiUrgencyScore: urgencyScore,
      aiSuggestedSlaHours: suggestedSlaHours,
      aiAssignedBranchReason: routing?.reasoning ?? aiReasoning,
      aiRouteMeta: routing
        ? (buildRoutingMeta(routing) as unknown as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      timeline: {
        create: [
          buildTimelineEntry({
            status: LaporanStatus.pending,
            note: "Laporan dibuat warga dan masuk validasi AI.",
            images: analysis.acceptedImagePaths,
            actorId: input.createdById,
            actorRole: "warga",
          }),
          buildTimelineEntry({
            status: LaporanStatus.verified,
            note: analysis.reasoning,
            images: [],
            actorId: null,
            actorRole: "ai",
          }),
        ],
      },
    },
    include: reportCreateInclude,
  });

  await createRoutingDecision({
    laporanId: laporan.id,
    kategoriId: resolvedKategori!.id,
    dinasId: resolvedKategori?.dinasId ?? null,
    cabangDinasId: routing?.assignedCabang?.id ?? null,
    source: routing?.routingSource ?? (aiClassified ? "ai_without_branch" : "manual_category"),
    confidence: aiConfidence,
    urgencyScore,
    suggestedSlaHours,
    distanceKm: routing?.distanceKm ?? null,
    wilayahMatched: routing?.wilayahMatched ?? routing?.wilayah ?? null,
    reasoning: routing?.reasoning ?? aiReasoning,
    candidateCabang: routing?.candidateCabang ?? [],
  });

  if (routing?.assignedCabang?.id) {
    notifyCabangOfficers(
      routing.assignedCabang.id,
      newReportNotification(laporan.title, laporan.id, resolvedKategori!.name),
    ).catch((error) => console.error("[notification] failed to notify cabang officers:", error));
  }

  return {
    ...laporan,
    timeline: buildTimelinePayload(laporan.timeline),
    aiReview: buildAiReview({
      accepted: true,
      confidence: analysis.confidence,
      reasoning: analysis.reasoning,
      clarityScore: analysis.clarityScore,
      seriousnessScore: analysis.seriousnessScore,
      acceptedImagePaths: analysis.acceptedImagePaths,
      ignoredImagePaths: analysis.ignoredImagePaths,
    }),
  };
}

export async function getReportById(id: string) {
  const laporan = await prisma.laporan.findUnique({
    where: { id },
    include: reportDetailInclude,
  });

  if (!laporan) {
    throw new AppError("Report not found", 404);
  }
  const feedbackMap = await getReportFeedbackByIds([laporan.id]);

  return {
    ...laporan,
    createdBy: buildReporterPayload(laporan.createdBy),
    timeline: buildTimelinePayload(laporan.timeline),
    aiReview: buildPersistedAiReview(laporan),
    ...getReportFeedback(feedbackMap, laporan.id),
  };
}

export async function updateReportStatus(input: UpdateReportStatusInput) {
  const status = requireReportStatus(input.status);
  if (status === LaporanStatus.resolved) {
    throw new AppError("Gunakan endpoint resolve dan sertakan bukti foto penyelesaian.", 400);
  }

  await assertReportEditableByUser(input.id, input.userId);
  const agencyNote = normalizeOptionalText(input.agencyNote ?? input.resolutionNote);
  const resolutionNote = normalizeOptionalText(input.resolutionNote);
  const images = normalizeImagePaths(input.images);

  if (status === LaporanStatus.clarification_requested && !agencyNote) {
    throw new AppError("Catatan klarifikasi wajib diisi.", 400);
  }

  const laporan = await prisma.laporan.update({
    where: { id: input.id },
    data: {
      status,
      ...(input.agencyNote !== undefined || input.resolutionNote !== undefined ? { agencyNote } : {}),
      resolvedAt: null,
      resolvedById: null,
      resolutionNote: null,
      timeline: {
        create: buildTimelineEntry({
          status,
          note: status === LaporanStatus.clarification_requested ? agencyNote : agencyNote ?? resolutionNote,
          images,
          actorId: input.userId,
          actorRole: "dinas",
        }),
      },
    },
    include: reportDetailInclude,
  });

  const dinasName = laporan.kategori?.dinas?.name || "Dinas";
  notifyUser({
    ...citizenStatusNotification(status, laporan.title, laporan.id, dinasName),
    userId: laporan.createdById,
  }).catch((error) => console.error("[notification] citizen notify failed:", error));

  if (laporan.cabangDinas?.id) {
    notifyCabangOfficers(
      laporan.cabangDinas.id,
      officerStatusNotification(status, laporan.title, laporan.id, laporan.assignedTo?.name),
    ).catch((error) => console.error("[notification] cabang notify failed:", error));
  }

  return {
    ...laporan,
    timeline: buildTimelinePayload(laporan.timeline),
    aiReview: buildPersistedAiReview(laporan),
  };
}

export async function submitReportClarification(input: SubmitReportClarificationInput) {
  const note = normalizeOptionalText(input.note);
  const images = normalizeImagePaths(input.images);

  if (!note) {
    throw new AppError("Balasan klarifikasi wajib diisi.", 400);
  }

  const existing = await prisma.laporan.findUnique({
    where: { id: input.id },
    include: {
      createdBy: { select: { id: true, name: true } },
      kategori: { include: { dinas: true } },
      cabangDinas: true,
    },
  });

  if (!existing) {
    throw new AppError("Report not found", 404);
  }

  if (existing.createdById !== input.userId) {
    throw new AppError("Forbidden", 403);
  }

  if (existing.status !== LaporanStatus.clarification_requested) {
    throw new AppError("Laporan ini tidak sedang membutuhkan klarifikasi.", 400);
  }

  const laporan = await prisma.laporan.update({
    where: { id: input.id },
    data: {
      status: LaporanStatus.in_progress,
      timeline: {
        create: buildTimelineEntry({
          status: LaporanStatus.in_progress,
          note,
          images,
          actorId: input.userId,
          actorRole: "warga",
        }),
      },
    },
    include: reportDetailInclude,
  });

  if (existing.cabangDinasId) {
    notifyCabangOfficers(
      existing.cabangDinasId,
      citizenClarificationNotification(existing.title, existing.id, existing.createdBy.name),
    ).catch((error) => console.error("[notification] cabang clarification notify failed:", error));
  }

  const feedbackMap = await getReportFeedbackByIds([laporan.id], input.userId);

  return {
    ...laporan,
    timeline: buildTimelinePayload(laporan.timeline),
    aiReview: buildPersistedAiReview(laporan),
    ...getReportFeedback(feedbackMap, laporan.id),
  };
}

export async function voteReport(input: VoteReportInput) {
  const vote = normalizeVoteValue(input.vote);
  const laporan = await getReportOrThrow(input.id);

  if (laporan.status === LaporanStatus.rejected) {
    throw new AppError("Laporan yang ditolak tidak dapat divote.", 400);
  }

  if (vote === 0) {
    await prisma.laporanVote.deleteMany({
      where: { laporanId: input.id, userId: input.userId },
    });
  } else {
    await prisma.laporanVote.upsert({
      where: {
        laporanId_userId: {
          laporanId: input.id,
          userId: input.userId,
        },
      },
      create: {
        laporanId: input.id,
        userId: input.userId,
        value: vote,
      },
      update: { value: vote },
    });
  }

  const feedbackMap = await getReportFeedbackByIds([input.id], input.userId);

  return {
    id: input.id,
    ...getReportFeedback(feedbackMap, input.id),
  };
}

export async function rateReport(input: RateReportInput) {
  const score = normalizeRatingScore(input.score);
  const note = normalizeOptionalText(input.note);
  const laporan = await prisma.laporan.findUnique({
    where: { id: input.id },
    include: {
      kategori: { include: { dinas: true } },
    },
  });

  if (!laporan) {
    throw new AppError("Report not found", 404);
  }

  if (laporan.createdById !== input.userId) {
    throw new AppError("Hanya pelapor yang bisa memberi rating.", 403);
  }

  if (laporan.status !== LaporanStatus.resolved) {
    throw new AppError("Rating hanya bisa diberikan setelah laporan selesai.", 400);
  }

  const rating = await prisma.laporanRating.upsert({
    where: { laporanId: input.id },
    create: {
      laporanId: input.id,
      userId: input.userId,
      dinasId: laporan.kategori?.dinasId ?? null,
      cabangDinasId: laporan.cabangDinasId ?? null,
      score,
      note,
    },
    update: {
      score,
      note,
      dinasId: laporan.kategori?.dinasId ?? null,
      cabangDinasId: laporan.cabangDinasId ?? null,
    },
  });

  return { id: input.id, rating };
}

export async function resolveReport(input: ResolveReportInput) {
  await assertReportEditableByUser(input.id, input.userId);
  const agencyNote = normalizeOptionalText(input.agencyNote ?? input.resolutionNote);
  const resolutionNote = normalizeOptionalText(input.resolutionNote);
  const resolutionImages = normalizeImagePaths(input.resolutionImages);

  if (resolutionImages.length === 0) {
    throw new AppError("Bukti foto penyelesaian wajib diupload.", 400);
  }

  const laporan = await prisma.laporan.update({
    where: { id: input.id },
    data: {
      status: "resolved",
      resolvedAt: new Date(),
      resolvedById: input.userId,
      ...(input.agencyNote !== undefined || input.resolutionNote !== undefined ? { agencyNote } : {}),
      resolutionNote,
      resolutionImages,
      timeline: {
        create: buildTimelineEntry({
          status: LaporanStatus.resolved,
          note: resolutionNote ?? agencyNote,
          images: resolutionImages,
          actorId: input.userId,
          actorRole: "dinas",
        }),
      },
    },
    include: reportDetailInclude,
  });

  const dinasName = laporan.kategori?.dinas?.name || "Dinas";
  notifyUser({
    ...citizenStatusNotification("resolved", laporan.title, laporan.id, dinasName),
    userId: laporan.createdById,
  }).catch((error) => console.error("[notification] citizen notify failed:", error));

  if (laporan.cabangDinas?.id) {
    notifyCabangOfficers(
      laporan.cabangDinas.id,
      officerStatusNotification("resolved", laporan.title, laporan.id, laporan.assignedTo?.name),
    ).catch((error) => console.error("[notification] cabang notify failed:", error));
  }

  return {
    ...laporan,
    timeline: buildTimelinePayload(laporan.timeline),
    aiReview: buildPersistedAiReview(laporan),
  };
}
