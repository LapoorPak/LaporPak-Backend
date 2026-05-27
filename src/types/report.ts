import type { Prisma } from "../generated/prisma/client.js";
import type { PaginationParams } from "../utils/apiResponse.js";

export type DashboardTab = "semua" | "baru" | "diproses" | "klarifikasi" | "tuntas";
export type ReportsScope = "mine" | "all";

export type ResolvedKategori = Prisma.MsKategoriLaporanGetPayload<{ include: { dinas: true } }>;

export interface ListReportsInput {
  pagination: PaginationParams;
  status?: string;
  kategoriId?: string;
  search?: string;
}

export interface ListMyReportsInput extends ListReportsInput {
  userId: string;
}

export interface ListReportLocationsInput {
  userId?: string;
  role?: string;
  scope?: ReportsScope;
  pagination?: PaginationParams;
  status?: string;
  kategoriId?: string;
  dinasId?: string;
  cabangDinasId?: string;
  createdById?: string;
  search?: string;
  sort?: string;
  minLat?: number;
  maxLat?: number;
  minLng?: number;
  maxLng?: number;
}

export interface GetReportDashboardInput {
  userId: string;
  role: string;
  scope?: ReportsScope;
  pagination: PaginationParams;
  tab?: string;
  requestedDinasId?: string;
  requestedCabangDinasId?: string;
  search?: string;
  kategoriId?: string;
}

export interface CreateReportInput {
  createdById: string;
  title?: string;
  description?: string;
  kategoriId?: string;
  address?: string;
  latitude: unknown;
  longitude: unknown;
  imagePaths: string[];
  aiImages?: {
    path: string;
    buffer: Buffer;
    mimeType: string;
    size: number;
  }[];
}

export interface UpdateReportStatusInput {
  id: string;
  userId: string;
  status?: string;
  resolutionNote?: unknown;
  agencyNote?: unknown;
  images?: string[];
}

export interface ResolveReportInput {
  id: string;
  userId: string;
  resolutionNote?: unknown;
  agencyNote?: unknown;
  resolutionImages?: string[];
}

export interface SubmitReportClarificationInput {
  id: string;
  userId: string;
  note?: unknown;
  images?: string[];
}

export interface VoteReportInput {
  id: string;
  userId: string;
  vote?: unknown;
}

export interface RateReportInput {
  id: string;
  userId: string;
  score?: unknown;
  note?: unknown;
}
