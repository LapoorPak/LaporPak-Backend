import { Router } from "express";

import { listCategories } from "../services/categoryService.js";
import { buildListResponse, parsePagination } from "../utils/apiResponse.js";

const router = Router();

function getStringQuery(value: unknown) {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : undefined;
  }

  return typeof value === "string" ? value : undefined;
}

// GET /api/categories
router.get("/", async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query, { defaultLimit: 20 });
    const payload = await listCategories({
      pagination,
      search: getStringQuery(req.query.search),
      dinasId: getStringQuery(req.query.dinasId),
    });

    res.json(
      buildListResponse(payload.data, pagination, payload.total, payload.stats),
    );
  } catch (error) {
    next(error);
  }
});

export default router;
