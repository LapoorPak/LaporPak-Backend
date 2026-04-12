import type { PaginationParams } from "../utils/apiResponse.js";

export interface ListAdminDinasInput {
  pagination: PaginationParams;
  search?: string;
  isActive?: boolean;
}

export interface ListAdminCabangInput {
  pagination: PaginationParams;
  search?: string;
  dinasId?: string;
  wilayah?: string;
  cityRegency?: string;
  isRoutingEnabled?: boolean;
}

export interface ListAdminKategoriInput {
  pagination: PaginationParams;
  search?: string;
  dinasId?: string;
  isActive?: boolean;
}

export interface ListAdminUsersInput {
  pagination: PaginationParams;
  search?: string;
  role?: string;
  banned?: boolean;
  hasPetugas?: boolean;
}

