import type { NextFunction, Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../config/auth.js";

declare global {
  namespace Express {
    interface Request {
      user: {
        id: string;
        name: string;
        email: string;
        role: string;
        image: string | null;
        phone: string | null;
      };
      session: {
        id: string;
        token: string;
        userId: string;
        expiresAt: Date;
      };
    }
  }
}

export class AppError extends Error {
  statusCode: number;
  details?: Record<string, unknown>;

  constructor(message: string, statusCode: number, details?: Record<string, unknown>) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session) {
      throw new AppError("Unauthorized", 401);
    }

    req.user = session.user as Request["user"];
    req.session = session.session as Request["session"];
    next();
  } catch (error) {
    next(error);
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError("Unauthorized", 401));
    }

    if (!roles.includes(req.user.role)) {
      return next(new AppError("Forbidden", 403));
    }

    next();
  };
}

const AGENCY_ROLES = ["dinas_pu", "dinas_dlhk", "dinas_bpbd", "dinas_dishub", "dinas_pln", "admin"];

export const requireAgencyRole = requireRole(...AGENCY_ROLES);
export const requireCitizenRole = requireRole("warga");
