import "dotenv/config";
import packageJson from "../../package.json" with { type: "json" };
import { prisma } from "./db.js";

function formatBytes(bytes: number) {
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatUptime(seconds: number) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  return [days && `${days}d`, hours && `${hours}h`, minutes && `${minutes}m`, `${secs}s`]
    .filter(Boolean)
    .join(" ");
}

export async function getHealthSnapshot() {
  const dbStart = Date.now();
  let databaseStatus: "up" | "down" = "up";
  let databaseError: string | undefined;

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    databaseStatus = "down";
    databaseError = error instanceof Error ? error.message : "Unknown database error";
  }

  const uptimeSeconds = process.uptime();
  const memoryUsage = process.memoryUsage();
  const status = databaseStatus === "up" ? "ok" : "degraded";

  return {
    status,
    service: packageJson.name,
    version: packageJson.version,
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
    uptime: {
      seconds: Math.floor(uptimeSeconds),
      human: formatUptime(uptimeSeconds),
    },
    checks: {
      database: {
        status: databaseStatus,
        latencyMs: Date.now() - dbStart,
        ...(databaseError ? { error: databaseError } : {}),
      },
    },
    system: {
      pid: process.pid,
      nodeVersion: process.version,
      memory: {
        rss: formatBytes(memoryUsage.rss),
        heapUsed: formatBytes(memoryUsage.heapUsed),
        heapTotal: formatBytes(memoryUsage.heapTotal),
      },
    },
  };
}
