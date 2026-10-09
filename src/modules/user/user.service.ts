import { Prisma } from "../../../prisma/generated/prisma/client";
import { Role, UserStatus } from "../../../prisma/generated/prisma/enums";
import prisma from "../../lib/prisma";
import { AppError } from "../../utils/appError";
import { logAudit } from "../../utils/auditLogger";

export const getAllUsers = async (query: {
  searchTerm?: string;
  role?: Role;
  status?: UserStatus;
  page?: string;
  limit?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.max(1, Number(query.limit) || 10);
  const skip = (page - 1) * limit;
  const sortBy = query.sortBy || "createdAt";
  const sortOrder = query.sortOrder || "desc";

  const andConditions: Prisma.UserWhereInput[] = [{ isDeleted: false }];

  if (query.searchTerm) {
    andConditions.push({
      OR: [
        { name: { contains: query.searchTerm, mode: "insensitive" } },
        { email: { contains: query.searchTerm, mode: "insensitive" } },
        { phone: { contains: query.searchTerm, mode: "insensitive" } },
      ],
    });
  }

  if (query.role) {
    andConditions.push({ role: query.role });
  }

  if (query.status) {
    andConditions.push({ status: query.status });
  }

  const whereCondition: Prisma.UserWhereInput = { AND: andConditions };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where: whereCondition,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        avatar: true,
        createdAt: true,
        technicianProfile: true,
      },
    }),
    prisma.user.count({ where: whereCondition }),
  ]);

  return {
    users,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getUserById = async (id: string) => {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      avatar: true,
      createdAt: true,
      isDeleted: true,
      technicianProfile: true,
    },
  });

  if (!user || user.isDeleted) {
    throw new AppError(404, "User not found");
  }

  return user;
};

export const updateProfile = async (
  userId: string,
  payload: { name?: string; phone?: string; avatar?: string }
) => {
  const user = await prisma.user.update({
    where: { id: userId },
    data: payload,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      avatar: true,
      updatedAt: true,
    },
  });

  return user;
};

export const updateUserStatus = async (
  userId: string,
  status: UserStatus,
  adminId: string
) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.isDeleted) {
    throw new AppError(404, "User not found");
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { status },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
    },
  });

  await logAudit({
    userId: adminId,
    action: "USER_STATUS_UPDATED",
    entity: "User",
    entityId: userId,
    details: { oldStatus: user.status, newStatus: status },
  });

  return updatedUser;
};

export const softDeleteUser = async (userId: string, adminId: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.isDeleted) {
    throw new AppError(404, "User not found");
  }

  if (user.role === Role.ADMIN && user.id === adminId) {
    throw new AppError(400, "Admins cannot delete their own account");
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      isDeleted: true,
      deletedAt: new Date(),
    },
  });

  await logAudit({
    userId: adminId,
    action: "USER_SOFT_DELETED",
    entity: "User",
    entityId: userId,
  });

  return { message: "User deleted successfully" };
};
