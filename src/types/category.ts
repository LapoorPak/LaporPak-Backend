import type { PaginationParams } from "../utils/apiResponse.js";

export interface ListCategoriesInput {
  pagination: PaginationParams;
  search?: string;
  dinasId?: string;
}
