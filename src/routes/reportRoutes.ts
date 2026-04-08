import { Router } from "express";

import { upload } from "../config/upload.js";
import { UPLOAD_PUBLIC_PATH } from "../config/storage.js";
import { prisma } from "../config/db.js";
import { AppError, requireAuth, requireAgencyRole, requireCitizenRole } from "../middleware/authMiddleware.js";
import { LaporanStatus, Prisma } from "../generated/prisma/client.js";
import { analyzeReportSubmission, getDinasTypeForCategory } from "../services/reportAiWrapper.js";
import { aiRejectedReportNotification, notifyCabangOfficers, notifyUser, newReportNotification, officerStatusNotification, citizenStatusNotification } from "../services/notificationService.js";
import { resolveCabangDinas } from "../services/routingService.js";
import { buildDataResponse, buildListResponse, parsePagination } from "../utils/apiResponse.js";

const router = Router();
const VALID_STATUSES = Object.values(LaporanStatus);
type ResolvedKategori = Prisma.KategoriLaporanGetPayload<{ include: { dinas: true } }>;

function getStringQuery(value: unknown) {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : undefined;
  }

  return typeof value === "string" ? value : undefined;
}

function getNumberQuery(value: unknown) {
  const parsed = Number(getStringQuery(value));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function getBodyString(value: unknown) {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : undefined;
  }

  return typeof value === "string" ? value : undefined;
}

function getBodyStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  if (typeof value !== "string") {
    return [];
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }

  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === "string")
        : [];
    } catch {
      return [trimmed];
    }
  }

  return [trimmed];
}

function getUploadedImagePaths(files: unknown) {
  if (!Array.isArray(files)) {
    return [];
  }

  return files
    .filter(
      (file): file is Express.Multer.File =>
        Boolean(file) && typeof file === "object" && "filename" in file,
    )
    .map((file) => `${UPLOAD_PUBLIC_PATH}/${file.filename}`);
}

function computeUrgencyScore(baseWeight: number, confidence: number | null) {
  const safeWeight = Math.max(0, Math.min(100, baseWeight));
  const safeConfidence = Math.max(0, Math.min(1, confidence ?? 0.5));
  return Math.round(safeWeight * 0.75 + safeConfidence * 25);
}

function buildRoutingMeta(routing: Awaited<ReturnType<typeof resolveCabangDinas>>) {
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
}) {
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

function buildReportLocationWhere(input: {
  status?: string;
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
    filters.push({ status: input.status as (typeof VALID_STATUSES)[number] });
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
  pagination?: ReturnType<typeof parsePagination>,
) {
  const [reports, total, stats] = await Promise.all([
    prisma.laporan.findMany({
      where,
      select: {
        id: true,
        title: true,
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
      ...(pagination
        ? {
            skip: pagination.skip,
            take: pagination.take,
          }
        : {}),
    }),
    prisma.laporan.count({ where }),
    getReportStats(where),
  ]);

  const data = reports.map((report) => ({
    id: report.id,
    title: report.title,
    lat: report.latitude,
    lng: report.longitude,
    status: report.status,
    routingStatus: report.routingStatus,
    urgencyScore: report.aiUrgencyScore,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
    kategori: report.kategori,
    dinas: report.kategori?.dinas ?? null,
    cabangDinas: report.cabangDinas,
    aiReview: buildPersistedAiReview(report),
  }));

  return {
    data,
    total,
    stats,
  };
}

// GET /api/reports
router.get("/", async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query, { defaultLimit: 10, maxLimit: 100 });
    const status = getStringQuery(req.query.status);
    const kategoriId = getStringQuery(req.query.kategoriId);
    const search = getStringQuery(req.query.search);
    if (status && !VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
      throw new AppError(`Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`, 400);
    }

    const where: Prisma.LaporanWhereInput = {};
    if (status) where.status = status as (typeof VALID_STATUSES)[number];
    if (kategoriId) where.kategoriId = kategoriId;
    if (search) where.title = { contains: search, mode: "insensitive" };

    const [laporan, total, stats] = await Promise.all([
      prisma.laporan.findMany({
        where,
        include: {
          kategori: { include: { dinas: true } },
          cabangDinas: { include: { dinas: true } },
          createdBy: { select: { id: true, name: true, image: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: pagination.skip,
        take: pagination.take,
      }),
      prisma.laporan.count({ where }),
      getReportStats(where),
    ]);

    res.json(
      buildListResponse(
        laporan.map((item) => ({
          ...item,
          aiReview: buildPersistedAiReview(item),
        })),
        pagination,
        total,
        stats,
      ),
    );
  } catch (error) {
    next(error);
  }
});

// GET /api/reports/me — MUST be before /:id
router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query, { defaultLimit: 10, maxLimit: 100 });
    const status = getStringQuery(req.query.status);
    const kategoriId = getStringQuery(req.query.kategoriId);
    const search = getStringQuery(req.query.search);
    if (status && !VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
      throw new AppError(`Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`, 400);
    }
    const where: Prisma.LaporanWhereInput = {
      createdById: req.user.id,
      ...(status ? { status: status as (typeof VALID_STATUSES)[number] } : {}),
      ...(kategoriId ? { kategoriId } : {}),
      ...(search ? { title: { contains: search, mode: "insensitive" } } : {}),
    };

    const [laporan, total, stats] = await Promise.all([
      prisma.laporan.findMany({
        where,
        include: {
          kategori: { include: { dinas: true } },
          cabangDinas: { include: { dinas: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: pagination.skip,
        take: pagination.take,
      }),
      prisma.laporan.count({ where }),
      getReportStats(where),
    ]);

    res.json(
      buildListResponse(
        laporan.map((item) => ({
          ...item,
          aiReview: buildPersistedAiReview(item),
        })),
        pagination,
        total,
        stats,
      ),
    );
  } catch (error) {
    next(error);
  }
});

// GET /api/reports/locations
router.get("/locations", async (req, res, next) => {
  try {
    const status = getStringQuery(req.query.status);

    if (status && !VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
      throw new AppError(`Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`, 400);
    }

    const where = buildReportLocationWhere({
      status,
      kategoriId: getStringQuery(req.query.kategoriId),
      dinasId: getStringQuery(req.query.dinasId),
      cabangDinasId: getStringQuery(req.query.cabangDinasId),
      createdById: getStringQuery(req.query.createdById),
      minLat: getNumberQuery(req.query.minLat),
      maxLat: getNumberQuery(req.query.maxLat),
      minLng: getNumberQuery(req.query.minLng),
      maxLng: getNumberQuery(req.query.maxLng),
      excludeRejected: true,
    });

    const payload = await getReportLocationPayload(where);

    res.json(buildDataResponse(payload.data, { total: payload.total, ...payload.stats }));
  } catch (error) {
    next(error);
  }
});

// POST /api/reports
router.post("/", requireAuth, requireCitizenRole, upload.array("images", 5), async (req, res, next) => {
  try {
    const title = getBodyString(req.body.title);
    const description = getBodyString(req.body.description);
    const kategoriId = getBodyString(req.body.kategoriId);
    const address = getBodyString(req.body.address);
    const latitude = getBodyString(req.body.latitude) ?? req.body.latitude;
    const longitude = getBodyString(req.body.longitude) ?? req.body.longitude;
    const bodyImagePaths = getBodyStringArray(req.body.images);
    const uploadedImagePaths = getUploadedImagePaths(req.files);
    const images = [...uploadedImagePaths, ...bodyImagePaths];

    if (!title || !description || latitude == null || longitude == null) {
      throw new AppError("title, description, latitude, and longitude are required", 400);
    }

    const latitudeValue = Number(latitude);
    const longitudeValue = Number(longitude);
    const inputImages = Array.isArray(images)
      ? images.filter((image): image is string => typeof image === "string")
      : [];
    let analysis: Awaited<ReturnType<typeof analyzeReportSubmission>>;

    try {
      analysis = await analyzeReportSubmission({
        title,
        description,
        imagePaths: inputImages,
      });
    } catch (e) {
      console.error("[report-ai] error:", e);
      analysis = buildUnavailableAiAnalysis({
        acceptedImagePaths: inputImages,
        ignoredImagePaths: [],
      });
    }

    const manualKategori = kategoriId
      ? await prisma.kategoriLaporan.findUnique({
          where: { id: kategoriId },
          include: { dinas: true },
        })
      : null;

    if (kategoriId && !manualKategori) {
      throw new AppError("Invalid kategoriId", 400);
    }

    if (!analysis.accepted) {
      const rejectedReport = await prisma.laporan.create({
        data: {
          title,
          description,
          status: "rejected",
          routingStatus: "failed",
          kategoriId: manualKategori?.id ?? null,
          latitude: latitudeValue,
          longitude: longitudeValue,
          address: address || null,
          images: analysis.acceptedImagePaths,
          createdById: req.user.id,
          aiDecisionStatus: "rejected",
          aiRejectionCode: analysis.rejectionCode,
          aiSuggestedRewrite: analysis.suggestedRewrite,
          aiClarityScore: analysis.clarityScore,
          aiSeriousnessScore: analysis.seriousnessScore,
          aiConfidence: analysis.confidence,
          aiReasoning: analysis.rejectionReason ?? analysis.reasoning,
          aiClassified: false,
          aiRouteMeta: {
            statusAi: "ditolak",
            alasanAi: analysis.rejectionReason,
            saranPerbaikanAi: analysis.suggestedRewrite,
            gambarDiabaikanAi: analysis.ignoredImagePaths,
            petunjukGambarAi: getImageInputHint(analysis.ignoredImagePaths),
          } as Prisma.InputJsonValue,
        },
        include: {
          kategori: { include: { dinas: true } },
          cabangDinas: { include: { dinas: true } },
          createdBy: { select: { id: true, name: true, image: true } },
        },
      });

      const rejectionReason =
        analysis.rejectionReason || "Laporan ditolak AI karena belum cukup jelas untuk diproses.";

      notifyUser({
        userId: req.user.id,
        ...aiRejectedReportNotification(title, rejectedReport.id, rejectionReason),
      }).catch((err) => console.error("[notification] ai reject notify failed:", err));

      return res.status(201).json(
        buildDataResponse({
          ...rejectedReport,
          aiReview: buildAiReview({
            accepted: false,
            confidence: analysis.confidence,
            reasoning: analysis.reasoning,
            clarityScore: analysis.clarityScore,
            seriousnessScore: analysis.seriousnessScore,
            acceptedImagePaths: analysis.acceptedImagePaths,
            ignoredImagePaths: analysis.ignoredImagePaths,
            rejectionCode: analysis.rejectionCode,
            rejectionReason: analysis.rejectionReason,
            suggestedRewrite: analysis.suggestedRewrite,
          }),
        }),
      );
    }

    let resolvedKategori: ResolvedKategori | null = null;
    let dinasType: string | undefined;
    let aiConfidence: number | null = analysis.confidence;
    let aiReasoning: string | null = analysis.reasoning;
    let aiClassified = !kategoriId;

    if (kategoriId) {
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
        const rejectedReport = await prisma.laporan.create({
          data: {
            title,
            description,
            status: "rejected",
            routingStatus: "failed",
            kategoriId: null,
            latitude: latitudeValue,
            longitude: longitudeValue,
            address: address || null,
            images: analysis.acceptedImagePaths,
            createdById: req.user.id,
            aiDecisionStatus: "rejected",
            aiRejectionCode: analysis.rejectionCode,
            aiSuggestedRewrite: analysis.suggestedRewrite,
            aiClarityScore: analysis.clarityScore,
            aiSeriousnessScore: analysis.seriousnessScore,
            aiConfidence: analysis.confidence,
            aiReasoning: analysis.rejectionReason ?? analysis.reasoning,
            aiClassified: false,
            aiRouteMeta: {
              statusAi: "ditolak",
              alasanAi: analysis.rejectionReason,
              saranPerbaikanAi: analysis.suggestedRewrite,
              gambarDiabaikanAi: analysis.ignoredImagePaths,
              petunjukGambarAi: getImageInputHint(analysis.ignoredImagePaths),
            } as Prisma.InputJsonValue,
          },
          include: {
            kategori: { include: { dinas: true } },
            cabangDinas: { include: { dinas: true } },
            createdBy: { select: { id: true, name: true, image: true } },
          },
        });

        const rejectionReason =
          analysis.rejectionReason || "Laporan ditolak AI karena belum cukup jelas untuk diproses.";

        notifyUser({
          userId: req.user.id,
          ...aiRejectedReportNotification(title, rejectedReport.id, rejectionReason),
        }).catch((err) => console.error("[notification] ai reject notify failed:", err));

        return res.status(201).json(
          buildDataResponse({
            ...rejectedReport,
            aiReview: buildAiReview({
              accepted: false,
              confidence: analysis.confidence,
              reasoning: analysis.reasoning,
              clarityScore: analysis.clarityScore,
              seriousnessScore: analysis.seriousnessScore,
              acceptedImagePaths: analysis.acceptedImagePaths,
              ignoredImagePaths: analysis.ignoredImagePaths,
              rejectionCode: analysis.rejectionCode,
              rejectionReason: analysis.rejectionReason,
              suggestedRewrite: analysis.suggestedRewrite,
            }),
          }),
        );
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

        const rejectedReport = await prisma.laporan.create({
          data: {
            title,
            description,
            status: "rejected",
            routingStatus: "failed",
            kategoriId: null,
            latitude: latitudeValue,
            longitude: longitudeValue,
            address: address || null,
            images: analysis.acceptedImagePaths,
            createdById: req.user.id,
            aiDecisionStatus: "rejected",
            aiRejectionCode: analysis.rejectionCode,
            aiSuggestedRewrite: analysis.suggestedRewrite,
            aiClarityScore: analysis.clarityScore,
            aiSeriousnessScore: analysis.seriousnessScore,
            aiConfidence: analysis.confidence,
            aiReasoning: analysis.rejectionReason ?? analysis.reasoning,
            aiClassified: false,
            aiRouteMeta: {
              statusAi: "ditolak",
              alasanAi: analysis.rejectionReason,
              saranPerbaikanAi: analysis.suggestedRewrite,
              gambarDiabaikanAi: analysis.ignoredImagePaths,
              petunjukGambarAi: getImageInputHint(analysis.ignoredImagePaths),
            } as Prisma.InputJsonValue,
          },
          include: {
            kategori: { include: { dinas: true } },
            cabangDinas: { include: { dinas: true } },
            createdBy: { select: { id: true, name: true, image: true } },
          },
        });

        notifyUser({
          userId: req.user.id,
          ...aiRejectedReportNotification(
            title,
            rejectedReport.id,
            analysis.rejectionReason || "Laporan ditolak AI.",
          ),
        }).catch((err) => console.error("[notification] ai reject notify failed:", err));

        return res.status(201).json(
          buildDataResponse({
            ...rejectedReport,
            aiReview: buildAiReview({
              accepted: false,
              confidence: analysis.confidence,
              reasoning: analysis.reasoning,
              clarityScore: analysis.clarityScore,
              seriousnessScore: analysis.seriousnessScore,
              acceptedImagePaths: analysis.acceptedImagePaths,
              ignoredImagePaths: analysis.ignoredImagePaths,
              rejectionCode: analysis.rejectionCode,
              rejectionReason: analysis.rejectionReason,
              suggestedRewrite: analysis.suggestedRewrite,
            }),
          }),
        );
      }

      resolvedKategori = kategori;
      dinasType = kategori.dinas.type || kategori.dinas.code || getDinasTypeForCategory(analysis.categoryCode!);
    }

    let routing = null;
    if (dinasType) {
      routing = await resolveCabangDinas({
        dinasType,
        latitude: latitudeValue,
        longitude: longitudeValue,
      });
    }

    const urgencyScore = computeUrgencyScore(
      resolvedKategori?.urgencyWeight ?? 50,
      aiConfidence,
    );
    const suggestedSlaHours = resolvedKategori?.slaHours ?? null;

    const laporan = await prisma.laporan.create({
      data: {
        title,
        description,
        kategoriId: resolvedKategori!.id,
        cabangDinasId: routing?.assignedCabang?.id ?? null,
        latitude: latitudeValue,
        longitude: longitudeValue,
        address: address || null,
        images: analysis.acceptedImagePaths,
        createdById: req.user.id,
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
      include: {
        kategori: { include: { dinas: true } },
        cabangDinas: { include: { dinas: true } },
        createdBy: { select: { id: true, name: true, image: true } },
      },
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
      ).catch((err) => console.error("[notification] failed to notify cabang officers:", err));
    }

    res.status(201).json(
      buildDataResponse({
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
      }),
    );
  } catch (error) {
    next(error);
  }
});

// GET /api/reports/:id
router.get("/:id", async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const laporan = await prisma.laporan.findUnique({
      where: { id },
      include: {
        kategori: { include: { dinas: true } },
        cabangDinas: { include: { dinas: true } },
        createdBy: { select: { id: true, name: true, image: true } },
        assignedTo: { select: { id: true, name: true, image: true } },
      },
    });

    if (!laporan) {
      throw new AppError("Report not found", 404);
    }

    res.json(
      buildDataResponse({
        ...laporan,
        aiReview: buildPersistedAiReview(laporan),
      }),
    );
  } catch (error) {
    next(error);
  }
});

// POST /api/reports/:id/status
router.post("/:id/status", requireAuth, requireAgencyRole, async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const { status, resolutionNote } = req.body;

    if (!status || !VALID_STATUSES.includes(status)) {
      throw new AppError(`Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`, 400);
    }

    const existing = await prisma.laporan.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new AppError("Report not found", 404);
    }

    const laporan = await prisma.laporan.update({
      where: { id },
      data: {
        status,
        resolvedAt: status === "resolved" ? new Date() : null,
        resolvedById: status === "resolved" ? req.user.id : null,
        resolutionNote: status === "resolved" ? String(resolutionNote || "") || null : null,
      },
      include: {
        kategori: { include: { dinas: true } },
        cabangDinas: { include: { dinas: true } },
        createdBy: { select: { id: true, name: true, image: true } },
        assignedTo: { select: { id: true, name: true, image: true } },
      },
    });

    // Notify the citizen who created the report
    const dinasName = laporan.kategori?.dinas?.name || "Dinas";
    notifyUser({
      ...citizenStatusNotification(status, laporan.title, laporan.id, dinasName),
      userId: laporan.createdById,
    }).catch((err) => console.error("[notification] citizen notify failed:", err));

    if (laporan.cabangDinas?.id) {
      notifyCabangOfficers(
        laporan.cabangDinas.id,
        officerStatusNotification(status, laporan.title, laporan.id, laporan.assignedTo?.name),
      ).catch((err) => console.error("[notification] cabang notify failed:", err));
    }

    res.json(
      buildDataResponse({
        ...laporan,
        aiReview: buildPersistedAiReview(laporan),
      }),
    );
  } catch (error) {
    next(error);
  }
});

// POST /api/reports/:id/resolve
router.post("/:id/resolve", requireAuth, requireAgencyRole, async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const { resolutionNote } = req.body;

    const existing = await prisma.laporan.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new AppError("Report not found", 404);
    }

    const laporan = await prisma.laporan.update({
      where: { id },
      data: {
        status: "resolved",
        resolvedAt: new Date(),
        resolvedById: req.user.id,
        resolutionNote: String(resolutionNote || "") || null,
      },
      include: {
        kategori: { include: { dinas: true } },
        cabangDinas: { include: { dinas: true } },
        createdBy: { select: { id: true, name: true, image: true } },
        assignedTo: { select: { id: true, name: true, image: true } },
      },
    });

    const dinasName = laporan.kategori?.dinas?.name || "Dinas";
    notifyUser({
      ...citizenStatusNotification("resolved", laporan.title, laporan.id, dinasName),
      userId: laporan.createdById,
    }).catch((err) => console.error("[notification] citizen notify failed:", err));

    if (laporan.cabangDinas?.id) {
      notifyCabangOfficers(
        laporan.cabangDinas.id,
        officerStatusNotification("resolved", laporan.title, laporan.id, laporan.assignedTo?.name),
      ).catch((err) => console.error("[notification] cabang notify failed:", err));
    }

    res.json(
      buildDataResponse({
        ...laporan,
        aiReview: buildPersistedAiReview(laporan),
      }),
    );
  } catch (error) {
    next(error);
  }
});

// POST /api/reports/:id/assign
router.post("/:id/assign", requireAuth, requireAgencyRole, async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const { assignedToId } = req.body;

    if (!assignedToId) {
      throw new AppError("assignedToId is required", 400);
    }

    const existing = await prisma.laporan.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new AppError("Report not found", 404);
    }

    const laporan = await prisma.laporan.update({
      where: { id },
      data: { assignedToId },
      include: {
        kategori: { include: { dinas: true } },
        cabangDinas: { include: { dinas: true } },
        createdBy: { select: { id: true, name: true, image: true } },
        assignedTo: { select: { id: true, name: true, image: true } },
      },
    });

    res.json(
      buildDataResponse({
        ...laporan,
        aiReview: buildPersistedAiReview(laporan),
      }),
    );
  } catch (error) {
    next(error);
  }
});

export default router;
