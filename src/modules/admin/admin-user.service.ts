import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "../../config/db.js";
import { Prisma, Stsrc } from "../../generated/prisma/client.js";
import { AppError } from "../../middleware/authMiddleware.js";
import type { ListAdminUsersInput } from "../../types/admin.js";

const NONE_FILTER_VALUE = "__none";
const BASE_ROLE_VALUES = ["admin", "warga"];

function getUserSortDirection(direction?: ListAdminUsersInput["sortDir"]) {
  return direction === "asc" ? "asc" : "desc";
}

function getAdminUserOrderBy(input: ListAdminUsersInput): Prisma.MsUserOrderByWithRelationInput {
  const direction = getUserSortDirection(input.sortDir);

  switch (input.sortBy) {
    case "name":
    case "email":
    case "role":
    case "banned":
    case "lastLoginAt":
      return { [input.sortBy]: direction };
    case "createdAt":
    default:
      return { createdAt: input.sortBy ? direction : "desc" };
  }
}

function getUserRoleFilter(input: ListAdminUsersInput): Prisma.MsUserWhereInput {
  const roles = input.roles?.length
    ? input.roles
    : input.role
      ? input.role.split(",").map((item) => item.trim()).filter(Boolean)
      : [];

  if (roles.length === 0) return {};
  if (roles.includes(NONE_FILTER_VALUE)) return { id: NONE_FILTER_VALUE };

  const filters: Prisma.MsUserWhereInput[] = [];
  if (roles.includes("admin")) {
    filters.push({ role: "admin" });
  }
  if (roles.includes("warga")) {
    filters.push({ role: "warga" });
  }
  if (roles.includes("dinas")) {
    filters.push({
      OR: [
        { role: { notIn: BASE_ROLE_VALUES } },
        { petugas: { isNot: null } },
      ],
    });
  }

  return filters.length > 0 ? { OR: filters } : { id: NONE_FILTER_VALUE };
}

export async function listAdminUsers(input: ListAdminUsersInput) {
  const roleFilter = getUserRoleFilter(input);
  const createdAtFilter =
    input.dateFrom || input.dateTo
      ? {
          createdAt: {
            ...(input.dateFrom ? { gte: input.dateFrom } : {}),
            ...(input.dateTo ? { lte: input.dateTo } : {}),
          },
        }
      : {};
  const where = {
    ...roleFilter,
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
    ...createdAtFilter,
  };

  const [data, total] = await Promise.all([
    prisma.msUser.findMany({
      where,
      orderBy: getAdminUserOrderBy(input),
      skip: input.pagination.skip,
      take: input.pagination.take,
      include: {
        sessions: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { createdAt: true },
        },
        petugas: {
          include: {
            cabangDinas: {
              include: { dinas: true },
            },
          },
        },
      },
    }),
    prisma.msUser.count({ where }),
  ]);

  return {
    data: data.map(({ sessions, ...user }) => ({
      ...user,
      lastLoginAt: user.lastLoginAt ?? sessions[0]?.createdAt ?? null,
    })),
    total,
  };
}

function getDayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getDayLabel(date: Date) {
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
  });
}

type AdminUserActivityInput = {
  days?: number;
  dateFrom?: Date;
  dateTo?: Date;
};

function getActivityDateRange(input: AdminUserActivityInput = {}) {
  const hasCustomRange = Boolean(input.dateFrom || input.dateTo);
  const fallbackDays = Math.min(60, Math.max(7, Math.floor(input.days ?? 14)));
  const endDate = input.dateTo ? new Date(input.dateTo) : new Date();
  endDate.setHours(23, 59, 59, 999);

  const startDate = input.dateFrom ? new Date(input.dateFrom) : new Date(endDate);
  startDate.setHours(0, 0, 0, 0);

  if (!input.dateFrom) {
    startDate.setDate(startDate.getDate() - (fallbackDays - 1));
  }

  if (startDate > endDate) {
    const swappedStart = new Date(startDate);
    startDate.setTime(endDate.getTime());
    endDate.setTime(swappedStart.getTime());
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
  }

  const requestedDays =
    Math.floor((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1;
  const safeDays = hasCustomRange
    ? Math.min(60, Math.max(1, requestedDays))
    : fallbackDays;

  if (requestedDays > safeDays) {
    startDate.setTime(endDate.getTime());
    startDate.setHours(0, 0, 0, 0);
    startDate.setDate(startDate.getDate() - (safeDays - 1));
  }

  return { startDate, endDate, safeDays };
}

export async function getAdminUserActivity(input: number | AdminUserActivityInput = {}) {
  const rangeInput = typeof input === "number" ? { days: input } : input;
  const { startDate, endDate, safeDays } = getActivityDateRange(rangeInput);

  const [sessions, newUsers] = await Promise.all([
    prisma.trSession.findMany({
      where: { createdAt: { gte: startDate, lte: endDate } },
      select: { userId: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.msUser.findMany({
      where: { createdAt: { gte: startDate, lte: endDate } },
      select: { id: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const buckets = Array.from({ length: safeDays }, (_, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);
    const key = getDayKey(date);

    return {
      date: key,
      label: getDayLabel(date),
      activeUserIds: new Set<string>(),
      sessions: 0,
      newUsers: 0,
    };
  });
  const bucketByDate = new Map(buckets.map((bucket) => [bucket.date, bucket]));

  sessions.forEach((session) => {
    const bucket = bucketByDate.get(getDayKey(session.createdAt));
    if (!bucket) return;

    bucket.activeUserIds.add(session.userId);
    bucket.sessions += 1;
  });

  newUsers.forEach((user) => {
    const bucket = bucketByDate.get(getDayKey(user.createdAt));
    if (!bucket) return;

    bucket.newUsers += 1;
  });

  const series = buckets.map((bucket) => ({
    date: bucket.date,
    label: bucket.label,
    activeUsers: bucket.activeUserIds.size,
    sessions: bucket.sessions,
    newUsers: bucket.newUsers,
  }));
  const totalActiveUsers = new Set(sessions.map((session) => session.userId)).size;
  const peak = series.reduce(
    (currentPeak, item) =>
      item.activeUsers > currentPeak.activeUsers ? item : currentPeak,
    series[0] ?? {
      date: getDayKey(startDate),
      label: getDayLabel(startDate),
      activeUsers: 0,
      sessions: 0,
      newUsers: 0,
    },
  );

  return {
    days: safeDays,
    from: getDayKey(startDate),
    to: getDayKey(endDate),
    summary: {
      activeToday: series[series.length - 1]?.activeUsers ?? 0,
      averageDailyActive:
        series.length > 0
          ? Math.round(
              series.reduce((sum, item) => sum + item.activeUsers, 0) /
                series.length,
            )
          : 0,
      peakActive: peak.activeUsers,
      peakDate: peak.date,
      totalActiveUsers,
      totalSessions: sessions.length,
      newUsers: newUsers.length,
    },
    series,
  };
}

export async function getAdminUserDetail(id: string) {
  const user = await prisma.msUser.findUnique({
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
  const existing = await prisma.msUser.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError("User tidak ditemukan", 404);
  }

  if (input.email && input.email !== existing.email) {
    const duplicate = await prisma.msUser.findUnique({ where: { email: input.email } });
    if (duplicate) {
      throw new AppError("Email sudah digunakan", 409);
    }
  }

  return prisma.msUser.update({
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
  const user = await prisma.msUser.findUnique({
    where: { id: input.userId },
    include: { accounts: true },
  });

  if (!user) {
    throw new AppError("User tidak ditemukan", 404);
  }

  const passwordHash = await hashPassword(input.newPassword);
  const credentialAccount = user.accounts.find((acc) => acc.providerId === "credential");

  if (credentialAccount) {
    await prisma.msAccount.update({
      where: { id: credentialAccount.id },
      data: { password: passwordHash },
    });
  } else {
    await prisma.msAccount.create({
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
    prisma.msUser.findUnique({ where: { id: input.userId } }),
    prisma.msCabangDinas.findFirst({
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

  const petugas = await prisma.msPetugasDinas.upsert({
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

  await prisma.msUser.update({
    where: { id: user.id },
    data: { role: cabang.dinas.type || cabang.dinas.code },
  });

  return {
    petugas,
    cabangDinas: cabang,
  };
}

export async function removePetugasFromUser(userId: string) {
  const user = await prisma.msUser.findUnique({
    where: { id: userId },
    include: { petugas: true },
  });

  if (!user) {
    throw new AppError("User tidak ditemukan", 404);
  }

  if (!user.petugas) {
    throw new AppError("User ini belum terdaftar sebagai petugas", 400);
  }

  await prisma.msPetugasDinas.delete({ where: { userId } });

  if (user.role !== "admin") {
    await prisma.msUser.update({
      where: { id: userId },
      data: { role: "warga" },
    });
  }

  return { userId };
}
