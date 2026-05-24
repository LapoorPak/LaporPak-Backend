import { prisma } from "../../config/db.js";
import { AppError } from "../../middleware/authMiddleware.js";

export async function getReportOrThrow(id: string) {
  const laporan = await prisma.laporan.findUnique({
    where: { id },
  });

  if (!laporan) {
    throw new AppError("Report not found", 404);
  }

  return laporan;
}

export async function assertReportEditableByUser(id: string, userId: string) {
  const [laporan, user] = await Promise.all([
    prisma.laporan.findUnique({
      where: { id },
      include: { kategori: { include: { dinas: true } } },
    }),
    prisma.user.findUnique({
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
  if (!officerDinasId || laporan.kategori?.dinasId !== officerDinasId) {
    throw new AppError("Forbidden", 403);
  }

  return laporan;
}
