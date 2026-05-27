import { prisma } from "../../config/db.js";
import { AppError } from "../../middleware/authMiddleware.js";
import type { GetSessionDetailInput } from "../../types/auth.js";

export async function getSessionDetail(input: GetSessionDetailInput) {
  const user = await prisma.msUser.findUnique({
    where: { id: input.userId },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      image: true,
      createdAt: true,
      updatedAt: true,
      role: true,
      banned: true,
      banReason: true,
      banExpires: true,
      phone: true,
      petugas: {
        select: {
          id: true,
          nip: true,
          cabangDinas: {
            select: {
              id: true,
              name: true,
              wilayah: true,
              address: true,
              latitude: true,
              longitude: true,
              phone: true,
              province: true,
              cityRegency: true,
              coverageRadiusKm: true,
              isRoutingEnabled: true,
              serviceTags: true,
              photos: true,
              metadata: true,
              dinas: {
                select: {
                  id: true,
                  code: true,
                  type: true,
                  name: true,
                  short: true,
                  wilayah: true,
                  description: true,
                  isActive: true,
                  routingPriority: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!user) {
    throw new AppError("Unauthorized", 401);
  }

  return {
    session: input.session,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      image: user.image,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      role: user.role,
      banned: user.banned,
      banReason: user.banReason,
      banExpires: user.banExpires,
      phone: user.phone,
    },
    petugas: user.petugas
      ? {
          id: user.petugas.id,
          nip: user.petugas.nip,
          cabangDinas: user.petugas.cabangDinas,
          dinas: user.petugas.cabangDinas.dinas,
        }
      : null,
  };
}
