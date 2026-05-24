import type { Request, Response } from "express";
import { listCategories } from "./category.service.js";
import { buildListResponse, parsePagination } from "../../utils/apiResponse.js";
import { getStringQuery } from "../../utils/requestParsing.js";

export async function listCategoriesController(req: Request, res: Response) {
  const pagination = parsePagination(req.query, { defaultLimit: 20 });
  const payload = await listCategories({
    pagination,
    search: getStringQuery(req.query.search),
    dinasId: getStringQuery(req.query.dinasId),
  });

  res.json(
    buildListResponse(payload.data, pagination, payload.total, payload.stats),
  );
}
