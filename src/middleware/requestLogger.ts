import type { NextFunction, Request, Response } from "express";

const COLORS = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
};

function statusColor(code: number) {
  if (code < 300) return COLORS.green;
  if (code < 400) return COLORS.yellow;
  return COLORS.red;
}

function formatBody(body: unknown): string {
  if (!body || typeof body !== "object") return "";

  const str = JSON.stringify(body);
  if (str === "{}" || str === "[]") return "";

  return str.length > 500 ? `${str.slice(0, 500)}...` : str;
}

function formatTimestamp() {
  return new Date().toISOString();
}

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  const originalJson = res.json.bind(res);
  let responseBody: unknown;

  res.json = ((body: unknown) => {
    responseBody = body;
    return originalJson(body);
  }) as Response["json"];

  res.on("finish", () => {
    const duration = Date.now() - start;
    const method = req.method.padEnd(6);
    const status = res.statusCode;
    const color = statusColor(status);
    const reqBody = formatBody(req.body);
    const resBody = formatBody(responseBody);
    const separator = `${COLORS.dim}${"=".repeat(72)}${COLORS.reset}`;

    let line =
      `${separator}\n` +
      `${COLORS.dim}${formatTimestamp()}${COLORS.reset} ` +
      `${COLORS.cyan}${method}${COLORS.reset} ${req.originalUrl} ` +
      `${color}${status}${COLORS.reset} ` +
      `${COLORS.magenta}${duration}ms${COLORS.reset}`;

    if (req.ip) {
      line += ` ${COLORS.dim}${req.ip}${COLORS.reset}`;
    }

    if (reqBody) {
      line += `\n  ${COLORS.dim}-> req:${COLORS.reset} ${reqBody}`;
    }

    if (resBody) {
      line += `\n  ${COLORS.dim}<- res:${COLORS.reset} ${resBody}`;
    }

    console.log(line);
  });

  next();
}
