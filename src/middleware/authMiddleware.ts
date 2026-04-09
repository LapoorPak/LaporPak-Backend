import type { NextFunction, Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../config/auth.js";
import type { AuthenticatedSession, AuthenticatedUser } from "../types/auth.js";
import { isAdminRole, isStaffRole } from "../utils/authPortal.js";

declare global {
  namespace Express {
    interface Request {
      user: AuthenticatedUser;
      session: AuthenticatedSession;
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

function isAgencyRole(role: string | undefined) {
  return isStaffRole(role);
}

export function requireAgencyRole(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) {
    return next(new AppError("Unauthorized", 401));
  }

  if (!isAgencyRole(req.user.role)) {
    return next(new AppError("Forbidden", 403));
  }

  next();
}

export function requireAdminRole(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) {
    return next(new AppError("Unauthorized", 401));
  }

  if (!isAdminRole(req.user.role)) {
    return next(new AppError("Forbidden", 403));
  }

  next();
}

export const requireCitizenRole = requireRole("warga");
