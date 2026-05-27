import { prisma } from "../../config/db.js";
import { Stsrc } from "../../generated/prisma/client.js";
import { AppError } from "../../middleware/authMiddleware.js";

export async function getReportOrThrow(id: string) {
  const laporan = await prisma.trLaporan.findFirst({
    where: { id, stsrc: { not: Stsrc.D } },
  });

  if (!laporan) {
    throw new AppError("Report not found", 404);
  }

  return laporan;
}

export async function assertReportEditableByUser(id: string, userId: string) {
  const [laporan, user] = await Promise.all([
    prisma.trLaporan.findFirst({
      where: { id, stsrc: { not: Stsrc.D } },
      include: {
        kategori: { select: { dinasId: true } },
        cabangDinas: { select: { dinasId: true } },
      },
    }),
    prisma.msUser.findUnique({
      where: { id: userId },
      select: {
        role: true,
        petugas: {
          select: {
            cabangDinas: { select: { dinasId: true } },
          },
        },
      },
    }),
  ]);

  if (!laporan) {
    throw new AppError("Report not found", 404);
  }

  if (user?.role === "admin") {
    return laporan;
  }

  const officerDinasId = user?.petugas?.cabangDinas.dinasId;
  const reportDinasId = laporan.cabangDinas?.dinasId ?? laporan.kategori?.dinasId;

  if (!officerDinasId || reportDinasId !== officerDinasId) {
    throw new AppError("Forbidden", 403);
  }

  return laporan;
}
