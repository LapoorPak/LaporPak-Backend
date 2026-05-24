import { LaporanStatus } from "../../generated/prisma/client.js";
import { AppError } from "../../middleware/authMiddleware.js";

export function normalizeOptionalText(value: unknown) {
  if (value == null) {
    return null;
  }

  if (typeof value !== "string") {
    return String(value).trim() || null;
  }

  return value.trim() || null;
}

export function normalizeImagePaths(value: unknown) {
  return Array.isArray(value)
    ? value.filter((image): image is string => typeof image === "string" && image.trim().length > 0)
    : [];
}

export function normalizeVoteValue(value: unknown) {
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

export function normalizeRatingScore(value: unknown) {
  const score = Number(Array.isArray(value) ? value[0] : value);
  if (!Number.isInteger(score) || score < 1 || score > 5) {
    throw new AppError("Rating harus berupa angka 1 sampai 5.", 400);
  }

  return score;
}

export function buildTimelineEntry(input: {
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
