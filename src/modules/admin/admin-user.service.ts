import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "../../config/db.js";
import { Stsrc } from "../../generated/prisma/client.js";
import { AppError } from "../../middleware/authMiddleware.js";
import type { ListAdminUsersInput } from "../../types/admin.js";

export async function listAdminUsers(input: ListAdminUsersInput) {
  const where = {
    ...(input.role ? { role: input.role } : {}),
    ...(input.banned === undefined ? {} : { banned: input.banned }),
    ...(input.hasPetugas === undefined
      ? {}
      : {
          petugas: input.hasPetugas ? { isNot: null } : { is: null },
        }),
    ...(input.search
      ? {
          OR: [
            { name: { contains: input.search, mode: "insensitive" as const } },
            { email: { contains: input.search, mode: "insensitive" as const } },
            { phone: { contains: input.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: input.pagination.skip,
      take: input.pagination.take,
      include: {
        petugas: {
          include: {
            cabangDinas: {
              include: { dinas: true },
            },
          },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return { data, total };
}

export async function getAdminUserDetail(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      petugas: {
        include: {
          cabangDinas: {
            include: { dinas: true },
          },
        },
      },
      accounts: true,
    },
  });

  if (!user) {
    throw new AppError("User tidak ditemukan", 404);
  }

  return user;
}

export async function updateAdminUser(
  id: string,
  input: {
    name?: string;
    email?: string;
    phone?: string | null;
    role?: string;
    banned?: boolean;
    banReason?: string | null;
    banExpires?: Date | null;
  },
) {
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError("User tidak ditemukan", 404);
  }

  if (input.email && input.email !== existing.email) {
    const duplicate = await prisma.user.findUnique({ where: { email: input.email } });
    if (duplicate) {
      throw new AppError("Email sudah digunakan", 409);
    }
  }

  return prisma.user.update({
    where: { id },
    data: {
      name: input.name,
      email: input.email,
      phone: input.phone ?? undefined,
      role: input.role,
      banned: input.banned,
      banReason: input.banReason ?? undefined,
      banExpires: input.banExpires ?? undefined,
    },
  });
}

export async function resetAdminUserPassword(input: { userId: string; newPassword: string }) {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    include: { accounts: true },
  });

  if (!user) {
    throw new AppError("User tidak ditemukan", 404);
  }

  const passwordHash = await hashPassword(input.newPassword);
  const credentialAccount = user.accounts.find((acc) => acc.providerId === "credential");

  if (credentialAccount) {
    await prisma.account.update({
      where: { id: credentialAccount.id },
      data: { password: passwordHash },
    });
  } else {
    await prisma.account.create({
      data: {
        id: randomUUID(),
        accountId: user.id,
        providerId: "credential",
        userId: user.id,
        password: passwordHash,
      },
    });
  }

  return { userId: user.id };
}

export async function assignPetugasToUser(input: {
  userId: string;
  cabangDinasId: string;
  nip?: string;
}) {
  const [user, cabang] = await Promise.all([
    prisma.user.findUnique({ where: { id: input.userId } }),
    prisma.cabangDinas.findFirst({
      where: { id: input.cabangDinasId, stsrc: { not: Stsrc.D } },
      include: { dinas: true },
    }),
  ]);

  if (!user) {
    throw new AppError("User tidak ditemukan", 404);
  }

  if (!cabang) {
    throw new AppError("Cabang dinas tidak ditemukan", 404);
  }

  const nip = input.nip ?? `ADM-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  const petugas = await prisma.petugasDinas.upsert({
    where: { userId: user.id },
    update: {
      cabangDinasId: cabang.id,
      nip,
    },
    create: {
      userId: user.id,
      cabangDinasId: cabang.id,
      nip,
    },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { role: cabang.dinas.type || cabang.dinas.code },
  });

  return {
    petugas,
    cabangDinas: cabang,
  };
}

export async function removePetugasFromUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { petugas: true },
  });

  if (!user) {
    throw new AppError("User tidak ditemukan", 404);
  }

  if (!user.petugas) {
    throw new AppError("User ini belum terdaftar sebagai petugas", 400);
  }

  await prisma.petugasDinas.delete({ where: { userId } });

  if (user.role !== "admin") {
    await prisma.user.update({
      where: { id: userId },
      data: { role: "warga" },
    });
  }

  return { userId };
}
