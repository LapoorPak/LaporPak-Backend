import { prisma } from "../config/db.js";
import { NotificationType } from "../generated/prisma/client.js";
import type { CreateNotificationInput, NotificationData } from "../types/notification.js";

export async function notifyDinasOfficers(dinasId: string, data: NotificationData) {
  const officers = await prisma.petugasDinas.findMany({
    where: { cabangDinas: { dinasId } },
    select: { userId: true },
  });

  if (officers.length === 0) return;

  await prisma.notification.createMany({
    data: officers.map((o) => ({
      ...data,
      deliveredAt: new Date(),
      userId: o.userId,
    })),
  });
}

export async function notifyUser(data: CreateNotificationInput) {
  await prisma.notification.create({
    data: {
      ...data,
      deliveredAt: new Date(),
    },
  });
}

export async function notifyCabangOfficers(cabangDinasId: string, data: NotificationData) {
  const officers = await prisma.petugasDinas.findMany({
    where: { cabangDinasId },
    select: { userId: true },
  });

  if (officers.length === 0) return;

  await prisma.notification.createMany({
    data: officers.map((officer) => ({
      ...data,
      deliveredAt: new Date(),
      userId: officer.userId,
    })),
  });
}

// Notification for officers when a new report is assigned to their dinas
export function newReportNotification(laporanTitle: string, laporanId: string, kategoriName: string): NotificationData {
  return {
    type: "info",
    title: "Laporan Baru Masuk",
    tag: "Baru",
    message: `Laporan baru "${laporanTitle}" (${kategoriName}) telah masuk dan menunggu ditangani.`,
    laporanId,
  };
}

// Notification for officers when a report status changes
export function officerStatusNotification(
  status: string,
  laporanTitle: string,
  laporanId: string,
  assigneeName?: string,
): NotificationData {
  const map: Record<string, { type: NotificationType; title: string; tag: string; message: string }> = {
    verified: {
      type: "info",
      title: "Laporan Diverifikasi",
      tag: "Proses",
      message: `Laporan "${laporanTitle}" telah diverifikasi dan siap ditindaklanjuti.`,
    },
    in_progress: {
      type: "warning",
      title: "Laporan Sedang Ditangani",
      tag: "Proses",
      message: `Laporan "${laporanTitle}" sedang ditangani oleh ${assigneeName || "petugas"}.`,
    },
    resolved: {
      type: "success",
      title: "Laporan Diselesaikan",
      tag: "Selesai",
      message: `Laporan "${laporanTitle}" telah diselesaikan.`,
    },
    rejected: {
      type: "danger",
      title: "Laporan Ditolak",
      tag: "Ditolak",
      message: `Laporan "${laporanTitle}" telah ditolak.`,
    },
  };

  return { ...map[status], laporanId };
}

// Notification for citizens when their report status changes
export function citizenStatusNotification(
  status: string,
  laporanTitle: string,
  laporanId: string,
  dinasName: string,
): NotificationData {
  const map: Record<string, { type: NotificationType; title: string; tag: string; message: string }> = {
    verified: {
      type: "info",
      title: "Laporan Diverifikasi",
      tag: "Proses",
      message: `Laporan Anda "${laporanTitle}" telah diverifikasi oleh ${dinasName}.`,
    },
    in_progress: {
      type: "warning",
      title: "Laporan Sedang Ditangani",
      tag: "Proses",
      message: `Laporan Anda "${laporanTitle}" sedang ditangani oleh ${dinasName}.`,
    },
    resolved: {
      type: "success",
      title: "Laporan Diselesaikan",
      tag: "Selesai",
      message: `Laporan Anda "${laporanTitle}" telah diselesaikan oleh ${dinasName}.`,
    },
    rejected: {
      type: "danger",
      title: "Laporan Ditolak",
      tag: "Ditolak",
      message: `Laporan Anda "${laporanTitle}" ditolak oleh ${dinasName}.`,
    },
  };

  return { ...map[status], laporanId };
}

export function aiRejectedReportNotification(
  laporanTitle: string,
  laporanId: string,
  rejectionReason: string,
): NotificationData {
  return {
    type: "danger",
    title: "Laporan Ditolak AI",
    tag: "Ditolak",
    message: `Laporan "${laporanTitle}" ditolak AI. Alasan: ${rejectionReason}`,
    laporanId,
  };
}

export function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "Baru saja";
  if (diffMin < 60) return `${diffMin} menit lalu`;
  if (diffHour < 24) return `${diffHour} jam lalu`;
  if (diffDay < 30) return `${diffDay} hari lalu`;
  return `${Math.floor(diffDay / 30)} bulan lalu`;
}
