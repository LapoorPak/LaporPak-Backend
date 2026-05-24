import { LaporanStatus } from "../../generated/prisma/client.js";
import { AppError } from "../../middleware/authMiddleware.js";
import type { DashboardTab } from "../../types/report.js";

export const VALID_REPORT_STATUSES = Object.values(LaporanStatus);
export const DASHBOARD_TABS = ["semua", "baru", "diproses", "klarifikasi", "tuntas"] as const;

export const DASHBOARD_DATE_FORMATTER = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function validateReportStatus(status?: string) {
  if (!status) {
    return undefined;
  }

  if (!VALID_REPORT_STATUSES.includes(status as LaporanStatus)) {
    throw new AppError(`Invalid status. Must be one of: ${VALID_REPORT_STATUSES.join(", ")}`, 400);
  }

  return status as LaporanStatus;
}

export function requireReportStatus(status?: string) {
  const resolvedStatus = validateReportStatus(status);

  if (!resolvedStatus) {
    throw new AppError(`Invalid status. Must be one of: ${VALID_REPORT_STATUSES.join(", ")}`, 400);
  }

  return resolvedStatus;
}

export function resolveDashboardTab(value?: string): DashboardTab {
  if (!value) {
    return "semua";
  }

  if (!DASHBOARD_TABS.includes(value as DashboardTab)) {
    throw new AppError(`Invalid tab. Must be one of: ${DASHBOARD_TABS.join(", ")}`, 400);
  }

  return value as DashboardTab;
}

export function buildReportDashboardTabWhere(tab: DashboardTab) {
  switch (tab) {
    case "baru":
      return { status: { in: [LaporanStatus.pending, LaporanStatus.verified] } };
    case "diproses":
      return { status: LaporanStatus.in_progress };
    case "klarifikasi":
      return { status: LaporanStatus.clarification_requested };
    case "tuntas":
      return { status: LaporanStatus.resolved };
    case "semua":
    default:
      return {};
  }
}

export function getDashboardStatusPresentation(status: LaporanStatus) {
  switch (status) {
    case LaporanStatus.pending:
      return {
        label: "Menunggu",
        group: "baru" as const,
        tone: "warning",
      };
    case LaporanStatus.verified:
      return {
        label: "Baru",
        group: "baru" as const,
        tone: "info",
      };
    case LaporanStatus.in_progress:
      return {
        label: "Diproses",
        group: "diproses" as const,
        tone: "warning",
      };
    case LaporanStatus.clarification_requested:
      return {
        label: "Butuh Klarifikasi",
        group: "klarifikasi" as const,
        tone: "danger",
      };
    case LaporanStatus.resolved:
      return {
        label: "Tuntas",
        group: "tuntas" as const,
        tone: "success",
      };
    case LaporanStatus.rejected:
    default:
      return {
        label: "Ditolak",
        group: "semua" as const,
        tone: "danger",
      };
  }
}
