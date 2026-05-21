import { prisma } from "../config/db.js";
import { LaporanStatus, Prisma } from "../generated/prisma/client.js";
import { AppError } from "../middleware/authMiddleware.js";
import {
  aiRejectedReportNotification,
  citizenClarificationNotification,
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
  RateReportInput,
  ResolveReportInput,
  ResolvedKategori,
  SubmitReportClarificationInput,
  UpdateReportStatusInput,
  VoteReportInput,
} from "../types/report.js";

const VALID_STATUSES = Object.values(LaporanStatus);
const DASHBOARD_TABS = ["semua", "baru", "diproses", "klarifikasi", "tuntas"] as const;
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
  timeline: { orderBy: { createdAt: "asc" } },
} satisfies Prisma.LaporanInclude;

const reportDetailInclude = {
  kategori: { include: { dinas: true } },
  cabangDinas: { include: { dinas: true } },
  createdBy: { select: { id: true, name: true, image: true } },
  assignedTo: { select: { id: true, name: true, image: true } },
  timeline: { orderBy: { createdAt: "asc" } },
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

function normalizeImagePaths(value: unknown) {
  return Array.isArray(value)
    ? value.filter((image): image is string => typeof image === "string" && image.trim().length > 0)
    : [];
}

function maskCitizenName(name?: string | null) {
  const trimmed = name?.trim();
  if (!trimmed) {
    return "Warga";
  }

  return trimmed
    .split(/\s+/)
    .map((part) => {
      if (part.length <= 2) {
        return `${part[0] ?? ""}${"*".repeat(Math.max(part.length - 1, 0))}`;
      }

      const middleLength = Math.max(1, part.length - 3);
      return `${part.slice(0, 1)}${"*".repeat(middleLength)}${part.slice(-2)}`;
    })
    .join(" ");
}

function shouldMaskReporterName(viewer?: { role?: string }) {
  return !viewer?.role || viewer.role === "warga";
}

function buildReporterPayload<T extends { id: string; name: string; image?: string | null }>(
  user: T | null | undefined,
  viewer?: { role?: string },
) {
  if (!user) {
    return null;
  }

  return {
    ...user,
    name: shouldMaskReporterName(viewer) ? maskCitizenName(user.name) : user.name,
  };
}

function normalizeVoteValue(value: unknown) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw == null || raw === "" || raw === 0 || raw === "0" || raw === null) {
    return 0;
  }

  if (raw === "up" || raw === "upvote" || raw === "1" || raw === 1) {
    return 1;
  }

  if (raw === "down" || raw === "downvote" || raw === "-1" || raw === -1) {
    return -1;
  }

  throw new AppError("Vote harus bernilai 1, -1, atau 0.", 400);
}

function normalizeRatingScore(value: unknown) {
  const score = Number(Array.isArray(value) ? value[0] : value);
  if (!Number.isInteger(score) || score < 1 || score > 5) {
    throw new AppError("Rating harus berupa angka 1 sampai 5.", 400);
  }

  return score;
}

function buildTimelineEntry(input: {
  status: LaporanStatus;
  note?: string | null;
  images?: string[];
  actorId?: string | null;
  actorRole?: string | null;
}) {
  return {
    status: input.status,
    note: input.note ?? null,
    images: input.images ?? [],
    actorId: input.actorId ?? null,
    actorRole: input.actorRole ?? null,
  };
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

function buildTimelinePayload(
  timeline?: Array<{
    id: string;
    status: LaporanStatus;
    note: string | null;
    images: string[];
    actorRole: string | null;
    createdAt: Date;
  }>,
) {
  return (timeline ?? []).map((item) => ({
    id: item.id,
    status: item.status,
    note: item.note,
    images: item.images ?? [],
    actorRole: item.actorRole,
    createdAt: item.createdAt,
  }));
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

type ReportFeedback = {
  upvotes: number;
  downvotes: number;
  voteScore: number;
  myVote: number | null;
  rating: {
    id: string;
    score: number;
    note: string | null;
    userId: string;
    dinasId: string | null;
    cabangDinasId: string | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
};

function emptyReportFeedback(): ReportFeedback {
  return {
    upvotes: 0,
    downvotes: 0,
    voteScore: 0,
    myVote: null,
    rating: null,
  };
}

async function getReportFeedbackByIds(laporanIds: string[], userId?: string | null) {
  const uniqueIds = [...new Set(laporanIds)].filter(Boolean);
  const feedbackMap = new Map<string, ReportFeedback>();

  for (const id of uniqueIds) {
    feedbackMap.set(id, emptyReportFeedback());
  }

  if (uniqueIds.length === 0) {
    return feedbackMap;
  }

  const [voteGroups, myVotes, ratings] = await Promise.all([
    prisma.laporanVote.groupBy({
      by: ["laporanId", "value"],
      where: { laporanId: { in: uniqueIds } },
      _count: { _all: true },
    }),
    userId
      ? prisma.laporanVote.findMany({
          where: { laporanId: { in: uniqueIds }, userId },
          select: { laporanId: true, value: true },
        })
      : Promise.resolve([]),
    prisma.laporanRating.findMany({
      where: { laporanId: { in: uniqueIds } },
      select: {
        laporanId: true,
        id: true,
        score: true,
        note: true,
        userId: true,
        dinasId: true,
        cabangDinasId: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);

  for (const group of voteGroups) {
    const feedback = feedbackMap.get(group.laporanId) ?? emptyReportFeedback();
    if (group.value > 0) {
      feedback.upvotes += group._count._all;
    } else if (group.value < 0) {
      feedback.downvotes += group._count._all;
    }
    feedback.voteScore = feedback.upvotes - feedback.downvotes;
    feedbackMap.set(group.laporanId, feedback);
  }

  for (const vote of myVotes) {
    const feedback = feedbackMap.get(vote.laporanId) ?? emptyReportFeedback();
    feedback.myVote = vote.value;
    feedbackMap.set(vote.laporanId, feedback);
  }

  for (const rating of ratings) {
    const feedback = feedbackMap.get(rating.laporanId) ?? emptyReportFeedback();
    feedback.rating = {
      id: rating.id,
      score: rating.score,
      note: rating.note,
      userId: rating.userId,
      dinasId: rating.dinasId,
      cabangDinasId: rating.cabangDinasId,
      createdAt: rating.createdAt,
      updatedAt: rating.updatedAt,
    };
    feedbackMap.set(rating.laporanId, feedback);
  }

  return feedbackMap;
}

function getReportFeedback(feedbackMap: Map<string, ReportFeedback>, laporanId: string) {
  return feedbackMap.get(laporanId) ?? emptyReportFeedback();
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
    case "klarifikasi":
      return { status: LaporanStatus.clarification_requested };
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
    case LaporanStatus.clarification_requested:
      return {
        label: "Butuh Klarifikasi",
        group: "klarifikasi" as const,
        tone: "danger",
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

async function getReportLocationPayload(
  where: Prisma.LaporanWhereInput,
  viewer?: { role?: string; dinasId?: string | null; userId?: string | null },
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
          Boolean(viewer?.dinasId && report.kategori?.dinas?.id === viewer.dinasId);

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
        Boolean(viewer?.dinasId && report.kategori?.dinas?.id === viewer.dinasId);

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

async function getReportOrThrow(id: string) {
  const laporan = await prisma.laporan.findUnique({
    where: { id },
  });

  if (!laporan) {
    throw new AppError("Report not found", 404);
  }

  return laporan;
}

async function assertReportEditableByUser(id: string, userId: string) {
  const [laporan, user] = await Promise.all([
    prisma.laporan.findUnique({
      where: { id },
      include: { kategori: { include: { dinas: true } } },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        petugas: {
          select: {
            cabangDinas: { select: { dinasId: true } },
          },
        },
      },
    }),
  ]);

  if (!laporan) {
    throw new AppError("Report not found", 404);
  }

  if (user?.role === "admin") {
    return laporan;
  }

  const officerDinasId = user?.petugas?.cabangDinas.dinasId;
  if (!officerDinasId || laporan.kategori?.dinasId !== officerDinasId) {
    throw new AppError("Forbidden", 403);
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
