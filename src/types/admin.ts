import type { PaginationParams } from "../utils/apiResponse.js";

export type SortDirection = "asc" | "desc";

export interface SortInput {
  sortBy?: string;
  sortDir?: SortDirection;
}

export interface ListAdminDinasInput extends SortInput {
  pagination: PaginationParams;
  search?: string;
  isActive?: boolean;
}

export interface ListAdminCabangInput extends SortInput {
  pagination: PaginationParams;
  search?: string;
  dinasId?: string;
  dinasIds?: string[];
  wilayah?: string;
  cityRegency?: string;
  isRoutingEnabled?: boolean;
}

export interface ListAdminKategoriInput extends SortInput {
  pagination: PaginationParams;
  search?: string;
  dinasId?: string;
  dinasIds?: string[];
  isActive?: boolean;
}

export interface ListAdminUsersInput extends SortInput {
  pagination: PaginationParams;
  search?: string;
  role?: string;
  roles?: string[];
  banned?: boolean;
  hasPetugas?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
}
