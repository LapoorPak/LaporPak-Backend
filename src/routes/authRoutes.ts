import { Router } from "express";

import { requireAuth } from "../middleware/authMiddleware.js";
import { getSessionDetail } from "../services/authSessionService.js";
import { buildDataResponse } from "../utils/apiResponse.js";

const router = Router();

// GET /api/auth/session-detail
router.get("/session-detail", requireAuth, async (req, res, next) => {
  try {
    const payload = await getSessionDetail({
      userId: req.user.id,
      session: req.session,
    });

    res.json(buildDataResponse(payload));
  } catch (error) {
    next(error);
  }
});

export default router;
