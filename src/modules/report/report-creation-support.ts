import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../config/db.js";
import { analyzeReportSubmission } from "./report-ai.service.js";
import { resolveCabangDinas } from "./report-routing.service.js";

type ReportAiAnalysis = Awaited<ReturnType<typeof analyzeReportSubmission>>;
type RoutingResolution = Awaited<ReturnType<typeof resolveCabangDinas>>;

export function computeUrgencyScore(baseWeight: number, confidence: number | null) {
  const safeWeight = Math.max(0, Math.min(100, baseWeight));
  const safeConfidence = Math.max(0, Math.min(1, confidence ?? 0.5));
  return Math.round(safeWeight * 0.75 + safeConfidence * 25);
}

export function buildRoutingMeta(routing: RoutingResolution) {
  return {
    routingSource: routing.routingSource,
    wilayah: routing.wilayah,
    wilayahMatched: routing.wilayahMatched,
    distanceKm: routing.distanceKm,
    reasoning: routing.reasoning,
    candidateCabang: routing.candidateCabang,
  };
}

export function buildUnavailableAiAnalysis(input: {
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

export async function createRoutingDecision(input: {
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
  await prisma.trLaporanRoutingDecision.create({
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
