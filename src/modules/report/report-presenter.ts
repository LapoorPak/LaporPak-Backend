import { LaporanStatus } from "../../generated/prisma/client.js";

export function maskCitizenName(name?: string | null) {
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

export function shouldMaskReporterName(viewer?: { role?: string }) {
  return !viewer?.role || viewer.role === "warga";
}

export function buildReporterPayload<T extends { id: string; name: string; image?: string | null }>(
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

export function getImageInputHint(ignoredImagePaths: string[]) {
  if (ignoredImagePaths.some((imagePath) => imagePath.startsWith("blob:"))) {
    return "Upload foto terlebih dahulu ke /api/upload/image lalu kirim URL hasil upload. Jangan kirim blob: URL dari browser.";
  }

  if (ignoredImagePaths.length > 0) {
    return "Sebagian URL gambar diabaikan karena formatnya tidak didukung backend.";
  }

  return null;
}

export function buildAiReview(input: {
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

export function buildPersistedAiReview(report: {
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

export function buildTimelinePayload(
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
