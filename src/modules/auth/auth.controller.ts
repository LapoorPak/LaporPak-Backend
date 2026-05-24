import type { Request, Response } from "express";

import { getSessionDetail } from "./auth-session.service.js";
import { buildDataResponse } from "../../utils/apiResponse.js";

export function rejectEmailOtpSignInController(_req: Request, res: Response) {
  res.status(403).json({
    error:
      "Passwordless OTP sign-in tidak diaktifkan. Gunakan login email/password lalu verifikasi email dengan kode OTP.",
  });
}

export async function getSessionDetailController(req: Request, res: Response) {
  const payload = await getSessionDetail({
    userId: req.user.id,
    session: req.session,
  });

  res.json(buildDataResponse(payload));
}
