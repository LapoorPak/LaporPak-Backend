import { prisma } from "../config/db.js";
import { LaporanStatus, Prisma } from "../generated/prisma/client.js";
import { AppError } from "../middleware/authMiddleware.js";
import {
  aiRejectedReportNotification,
  citizenStatusNotification,
  newReportNotification,
  notifyCabangOfficers,
  notifyUser,
  officerStatusNotification,
} from "./notificationService.js";
import { analyzeReportSubmission, getDinasTypeForCategory } from "./reportAiWrapper.js";
import { resolveCabangDinas } from "./routingService.js";
import type {
  CreateReportInput,
  DashboardTab,
  GetReportDashboardInput,
  ListMyReportsInput,
  ListReportLocationsInput,
  ListReportsInput,
  ResolveReportInput,
  ResolvedKategori,
  UpdateReportStatusInput,
} from "../types/report.js";

const VALID_STATUSES = Object.values(LaporanStatus);
const DASHBOARD_TABS = ["semua", "baru", "diproses", "tuntas"] as const;
const DASHBOARD_DATE_FORMATTER = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
type ReportAiAnalysis = Awaited<ReturnType<typeof analyzeReportSubmission>>;
type RoutingResolution = Awaited<ReturnType<typeof resolveCabangDinas>>;

const reportCreateInclude = {
  kategori: { include: { dinas: true } },
  cabangDinas: { include: { dinas: true } },
  createdBy: { select: { id: true, name: true, image: true } },
} satisfies Prisma.LaporanInclude;

const reportDetailInclude = {
  kategori: { include: { dinas: true } },
  cabangDinas: { include: { dinas: true } },
  createdBy: { select: { id: true, name: true, image: true } },
  assignedTo: { select: { id: true, name: true, image: true } },
} satisfies Prisma.LaporanInclude;

function validateReportStatus(status?: string) {
  if (!status) {
    return undefined;
  }

  if (!VALID_STATUSES.includes(status as LaporanStatus)) {
    throw new AppError(`Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`, 400);
  }

  return status as LaporanStatus;
}

function requireReportStatus(status?: string) {
  const resolvedStatus = validateReportStatus(status);

  if (!resolvedStatus) {
    throw new AppError(`Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`, 400);
  }

  return resolvedStatus;
}

function resolveDashboardTab(value?: string): DashboardTab {
  if (!value) {
    return "semua";
  }

  if (!DASHBOARD_TABS.includes(value as DashboardTab)) {
    throw new AppError(`Invalid tab. Must be one of: ${DASHBOARD_TABS.join(", ")}`, 400);
  }

  return value as DashboardTab;
}

function computeUrgencyScore(baseWeight: number, confidence: number | null) {
  const safeWeight = Math.max(0, Math.min(100, baseWeight));
  const safeConfidence = Math.max(0, Math.min(1, confidence ?? 0.5));
  return Math.round(safeWeight * 0.75 + safeConfidence * 25);
}

function buildRoutingMeta(routing: RoutingResolution) {
  return {
    routingSource: routing.routingSource,
    wilayah: routing.wilayah,
    wilayahMatched: routing.wilayahMatched,
    distanceKm: routing.distanceKm,
    reasoning: routing.reasoning,
    candidateCabang: routing.candidateCabang,
  };
}

function getImageInputHint(ignoredImagePaths: string[]) {
  if (ignoredImagePaths.some((imagePath) => imagePath.startsWith("blob:"))) {
    return "Upload foto terlebih dahulu ke /api/upload/image lalu kirim URL hasil upload. Jangan kirim blob: URL dari browser.";
  }

  if (ignoredImagePaths.length > 0) {
    return "Sebagian URL gambar diabaikan karena formatnya tidak didukung backend.";
  }

  return null;
}

function normalizeOptionalText(value: unknown) {
  if (value == null) {
    return null;
  }

  if (typeof value !== "string") {
    return String(value).trim() || null;
  }

  return value.trim() || null;
}

function buildAiReview(input: {
  accepted: boolean;
  confidence: number;
  reasoning: string;
  clarityScore: number;
  seriousnessScore: number;
  acceptedImagePaths: string[];
  ignoredImagePaths: string[];
  rejectionCode?: string | null;
  rejectionReason?: string | null;
  suggestedRewrite?: string | null;
}) {
  return {
    statusAi: input.accepted ? "diterima" : "ditolak",
    diterimaAi: input.accepted,
    ditolakAi: !input.accepted,
    confidence: input.confidence,
    alasanAi: input.accepted ? input.reasoning : input.rejectionReason ?? input.reasoning,
    saranPerbaikanAi: input.accepted ? null : input.suggestedRewrite ?? null,
    skorKejelasanAi: input.clarityScore,
    skorKeseriusanAi: input.seriousnessScore,
    kodePenolakanAi: input.accepted ? null : input.rejectionCode ?? null,
    gambarDiterimaAi: input.acceptedImagePaths,
    gambarDiabaikanAi: input.ignoredImagePaths,
    petunjukGambarAi: getImageInputHint(input.ignoredImagePaths),
  };
}

function buildPersistedAiReview(report: {
  aiDecisionStatus: string | null;
  aiConfidence: number | null;
  aiReasoning: string | null;
  aiSuggestedRewrite: string | null;
  aiClarityScore: number | null;
  aiSeriousnessScore: number | null;
  aiRejectionCode: string | null;
  images?: string[];
}) {
  const accepted = report.aiDecisionStatus !== "rejected";

  return {
    statusAi: accepted ? "diterima" : "ditolak",
    diterimaAi: accepted,
    ditolakAi: !accepted,
    confidence: report.aiConfidence ?? 0,
    alasanAi: report.aiReasoning,
    saranPerbaikanAi: report.aiSuggestedRewrite,
    skorKejelasanAi: report.aiClarityScore,
    skorKeseriusanAi: report.aiSeriousnessScore,
    kodePenolakanAi: report.aiRejectionCode,
    gambarDiterimaAi: report.images ?? [],
    gambarDiabaikanAi: [],
    petunjukGambarAi: null,
  };
}

function buildUnavailableAiAnalysis(input: {
  acceptedImagePaths: string[];
  ignoredImagePaths: string[];
}): ReportAiAnalysis {
  return {
    accepted: false,
    rejectionCode: "ai_wrapper_unavailable",
    rejectionReason:
      "AI wrapper sedang sibuk atau tidak tersedia, sehingga laporan belum bisa diproses otomatis.",
    suggestedRewrite:
      "Coba kirim ulang beberapa saat lagi. Jika tetap gagal, perjelas laporan dan pilih kategori manual bila tersedia.",
    categoryCode: null,
    confidence: 0,
    clarityScore: 0,
    seriousnessScore: 0,
    reasoning: "AI wrapper tidak memberikan hasil klasifikasi.",
    acceptedImagePaths: input.acceptedImagePaths,
    ignoredImagePaths: input.ignoredImagePaths,
  };
}

async function createRoutingDecision(input: {
  laporanId: string;
  kategoriId: string;
  dinasId: string | null;
  cabangDinasId: string | null;
  source: string;
  confidence: number | null;
  urgencyScore: number | null;
  suggestedSlaHours: number | null;
  distanceKm: number | null;
  wilayahMatched: string | null;
  reasoning: string | null;
  candidateCabang: unknown;
}) {
  await prisma.laporanRoutingDecision.create({
    data: {
      laporanId: input.laporanId,
      kategoriId: input.kategoriId,
      dinasId: input.dinasId,
      cabangDinasId: input.cabangDinasId,
      source: input.source,
      confidence: input.confidence,
      urgencyScore: input.urgencyScore,
      suggestedSlaHours: input.suggestedSlaHours,
      distanceKm: input.distanceKm,
      wilayahMatched: input.wilayahMatched,
      reasoning: input.reasoning,
      candidateCabang: input.candidateCabang as Prisma.InputJsonValue,
    },
  });
}

async function getReportStats(where: Prisma.LaporanWhereInput) {
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
        where: { id: { in: categoryIds } },
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

function combineReportWhere(
  ...conditions: Array<Prisma.LaporanWhereInput | null | undefined>
): Prisma.LaporanWhereInput {
  const filters = conditions.filter((condition): condition is Prisma.LaporanWhereInput => {
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

function buildReportDashboardBaseWhere(input: {
  search?: string;
  dinasId?: string;
  cabangDinasId?: string;
  kategoriId?: string;
}): Prisma.LaporanWhereInput {
  const filters: Prisma.LaporanWhereInput[] = [{ status: { not: LaporanStatus.rejected } }];

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

function buildReportDashboardTabWhere(tab: DashboardTab): Prisma.LaporanWhereInput {
  switch (tab) {
    case "baru":
      return { status: { in: [LaporanStatus.pending, LaporanStatus.verified] } };
    case "diproses":
      return { status: LaporanStatus.in_progress };
    case "tuntas":
      return { status: LaporanStatus.resolved };
    case "semua":
    default:
      return {};
  }
}

function getDashboardStatusPresentation(status: LaporanStatus) {
  switch (status) {
    case LaporanStatus.pending:
      return {
        label: "Menunggu",
        group: "baru" as const,
        tone: "warning",
      };
    case LaporanStatus.verified:
      return {
        label: "Baru",
        group: "baru" as const,
        tone: "info",
      };
    case LaporanStatus.in_progress:
      return {
        label: "Diproses",
        group: "diproses" as const,
        tone: "warning",
      };
    case LaporanStatus.resolved:
      return {
        label: "Tuntas",
        group: "tuntas" as const,
        tone: "success",
      };
    case LaporanStatus.rejected:
    default:
      return {
        label: "Ditolak",
        group: "semua" as const,
        tone: "danger",
      };
  }
}

async function getReportDashboardSummary(where: Prisma.LaporanWhereInput) {
  const groupedByStatus = await prisma.laporan.groupBy({
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
    resolved: 0,
    rejected: 0,
  };

  for (const entry of groupedByStatus) {
    counts[entry.status] = entry._count._all;
  }

  const laporanBaru = counts.pending + counts.verified;
  const diproses = counts.in_progress;
  const tuntas = counts.resolved;
  const totalTarget = laporanBaru + diproses + tuntas;

  return {
    totalTarget,
    laporanBaru,
    diproses,
    tuntas,
    byStatusRaw: counts,
  };
}

async function getAgencyDashboardScope(input: {
  userId: string;
  role: string;
  requestedDinasId?: string;
  requestedCabangDinasId?: string;
}) {
  const isAdmin = input.role === "admin";
  let scopeDinasId = input.requestedDinasId;
  let scopeCabangDinasId = input.requestedCabangDinasId ?? null;

  const requestedCabang = input.requestedCabangDinasId
    ? await prisma.cabangDinas.findUnique({
        where: { id: input.requestedCabangDinasId },
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
    const officer = await prisma.petugasDinas.findUnique({
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

    scopeDinasId = officerDinasId;

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
      isAdminScope: false,
    };
  }

  if (!scopeDinasId) {
    throw new AppError("dinasId atau cabangDinasId wajib diisi untuk akun admin", 400);
  }

  const dinas =
    requestedCabang?.dinas ??
    (await prisma.dinas.findUnique({
      where: { id: scopeDinasId },
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
    isAdminScope: true,
  };
}

function buildReportLocationWhere(input: {
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
  const filters: Prisma.LaporanWhereInput[] = [];

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

  if (filters.length === 0) {
    return {};
  }

  return { AND: filters };
}

async function getReportLocationPayload(where: Prisma.LaporanWhereInput) {
  const [reports, total, stats] = await Promise.all([
    prisma.laporan.findMany({
      where,
      select: {
        id: true,
        title: true,
        agencyNote: true,
        resolutionNote: true,
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
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.laporan.count({ where }),
    getReportStats(where),
  ]);

  return {
    data: reports.map((report) => ({
      id: report.id,
      title: report.title,
      agencyNote: report.agencyNote,
      resolutionNote: (report as any).resolutionNote ?? null,
      images: report.images ?? [],
      lat: report.latitude,
      lng: report.longitude,
      status: report.status,
      routingStatus: report.routingStatus,
      urgencyScore: report.aiUrgencyScore,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
      createdBy: report.createdBy ?? null,
      kategori: report.kategori,
      dinas: report.kategori?.dinas ?? null,
      cabangDinas: report.cabangDinas,
      aiReview: buildPersistedAiReview(report),
    })),
    total,
    stats,
  };
}

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

async function getReportOrThrow(id: string) {
  const laporan = await prisma.laporan.findUnique({
    where: { id },
  });

  if (!laporan) {
    throw new AppError("Report not found", 404);
  }

  return laporan;
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
      },
      orderBy: { createdAt: "desc" },
      skip: input.pagination.skip,
      take: input.pagination.take,
    }),
    prisma.laporan.count({ where }),
    getReportStats(where),
  ]);

  return {
    data: laporan.map((item) => ({
      ...item,
      aiReview: buildPersistedAiReview(item),
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
      },
      orderBy: { createdAt: "desc" },
      skip: input.pagination.skip,
      take: input.pagination.take,
    }),
    prisma.laporan.count({ where }),
    getReportStats(where),
  ]);

  return {
    data: laporan.map((item) => ({
      ...item,
      aiReview: buildPersistedAiReview(item),
    })),
    total,
    stats,
  };
}

export async function listReportLocations(input: ListReportLocationsInput) {
  const where = buildReportLocationWhere({
    status: validateReportStatus(input.status),
    kategoriId: input.kategoriId,
    dinasId: input.dinasId,
    cabangDinasId: input.cabangDinasId,
    createdById: input.createdById,
    search: input.search,
    minLat: input.minLat,
    maxLat: input.maxLat,
    minLng: input.minLng,
    maxLng: input.maxLng,
    excludeRejected: true,
  });

  return getReportLocationPayload(where);
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

  return {
    ...laporan,
    aiReview: buildPersistedAiReview(laporan),
  };
}

export async function updateReportStatus(input: UpdateReportStatusInput) {
  const status = requireReportStatus(input.status);
  await getReportOrThrow(input.id);
  const agencyNote = normalizeOptionalText(input.agencyNote ?? input.resolutionNote);
  const resolutionNote = normalizeOptionalText(input.resolutionNote);

  const laporan = await prisma.laporan.update({
    where: { id: input.id },
    data: {
      status,
      ...(input.agencyNote !== undefined || input.resolutionNote !== undefined ? { agencyNote } : {}),
      resolvedAt: status === "resolved" ? new Date() : null,
      resolvedById: status === "resolved" ? input.userId : null,
      resolutionNote: status === "resolved" ? resolutionNote : null,
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
    aiReview: buildPersistedAiReview(laporan),
  };
}

export async function resolveReport(input: ResolveReportInput) {
  await getReportOrThrow(input.id);
  const agencyNote = normalizeOptionalText(input.agencyNote ?? input.resolutionNote);
  const resolutionNote = normalizeOptionalText(input.resolutionNote);

  const laporan = await prisma.laporan.update({
    where: { id: input.id },
    data: {
      status: "resolved",
      resolvedAt: new Date(),
      resolvedById: input.userId,
      ...(input.agencyNote !== undefined || input.resolutionNote !== undefined ? { agencyNote } : {}),
      resolutionNote,
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
    aiReview: buildPersistedAiReview(laporan),
  };
}
