import type { LaporanStatus } from "../generated/prisma/client.js";
import type { PaginationParams } from "../utils/apiResponse.js";

export interface AgencyLocationFilters {
  search?: string;
  type?: string;
  dinasId?: string;
  cityRegency?: string;
  wilayah?: string;
}

export interface ListAgenciesInput {
  pagination: PaginationParams;
  search?: string;
  type?: string;
}

export interface ListAgencyReportsInput {
  agencyId: string;
  pagination: PaginationParams;
  status?: LaporanStatus;
}
