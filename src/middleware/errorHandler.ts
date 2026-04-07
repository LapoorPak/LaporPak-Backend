import type { NextFunction, Request, Response } from "express";

export const errorHandler = (
  err: Error & { statusCode?: number; details?: Record<string, unknown> },
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  if (err.statusCode) {
    res.status(err.statusCode).json({
      error: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
    return;
  }

  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
};
