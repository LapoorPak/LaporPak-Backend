import type { ParsedQs } from "qs";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

function getQueryValue(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    const firstValue = value[0];
    return typeof firstValue === "string" ? firstValue : undefined;
  }

  return typeof value === "string" ? value : undefined;
}

function toPositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.floor(parsed);
}

export interface PaginationOptions {
  defaultLimit?: number;
  maxLimit?: number;
}

export interface PaginationParams {
  page: number;
  limit: number;
  take: number;
  skip: number;
}

export function parsePagination(
  query: ParsedQs,
  options: PaginationOptions = {},
): PaginationParams {
  const defaultLimit = options.defaultLimit ?? DEFAULT_LIMIT;
  const maxLimit = options.maxLimit ?? MAX_LIMIT;
  const page = toPositiveInt(getQueryValue(query.page), DEFAULT_PAGE);
  const requestedTake = getQueryValue(query.take);
  const requestedLimit = getQueryValue(query.limit);
  const resolvedLimit = toPositiveInt(requestedTake ?? requestedLimit, defaultLimit);
  const limit = Math.min(maxLimit, resolvedLimit);

  return {
    page,
    limit,
    take: limit,
    skip: (page - 1) * limit,
  };
}

export function buildMeta(pagination: PaginationParams, total: number) {
  const totalPages = total === 0 ? 0 : Math.ceil(total / pagination.limit);

  return {
    page: pagination.page,
    limit: pagination.limit,
    take: pagination.take,
    total,
    totalPages,
    hasNextPage: pagination.page < totalPages,
    hasPrevPage: pagination.page > 1,
  };
}

export function buildListResponse<T>(
  data: T[],
  pagination: PaginationParams,
  total: number,
  stats?: Record<string, unknown>,
) {
  return {
    data,
    meta: buildMeta(pagination, total),
    stats: {
      total,
      ...(stats ?? {}),
    },
  };
}

export function buildDataResponse<T>(data: T, stats?: Record<string, unknown>) {
  return {
    data,
    ...(stats ? { stats } : {}),
  };
}
