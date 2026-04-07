import { Router } from "express";

import { prisma } from "../config/db.js";

const router = Router();

// GET /api/categories
router.get("/", async (_req, res, next) => {
  try {
    const categories = await prisma.kategoriLaporan.findMany({
      include: { dinas: true },
      orderBy: { name: "asc" },
    });

    res.json(categories);
  } catch (error) {
    next(error);
  }
});

export default router;
