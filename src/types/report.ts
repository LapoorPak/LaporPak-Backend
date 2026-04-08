import type { Prisma } from "../generated/prisma/client.js";
import type { PaginationParams } from "../utils/apiResponse.js";

export type DashboardTab = "semua" | "baru" | "diproses" | "tuntas";

export type ResolvedKategori = Prisma.KategoriLaporanGetPayload<{ include: { dinas: true } }>;

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
}

export interface GetReportDashboardInput {
  userId: string;
  role: string;
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
}

export interface UpdateReportStatusInput {
  id: string;
  userId: string;
  status?: string;
  resolutionNote?: unknown;
  agencyNote?: unknown;
}

export interface ResolveReportInput {
  id: string;
  userId: string;
  resolutionNote?: unknown;
  agencyNote?: unknown;
}

export interface AssignReportInput {
  id: string;
  assignedToId?: string;
}
