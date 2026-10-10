import { Prisma } from "../../../prisma/generated/prisma/client";
import prisma from "../../lib/prisma";
import { getCache, setCache, deleteCachePattern } from "../../lib/redis";
import { AppError } from "../../utils/appError";
import { logAudit } from "../../utils/auditLogger";

export const createService = async (
  payload: {
    name: string;
    description: string;
    category: string;
    basePrice: number;
    estimatedDurationHours?: number;
    isAvailable?: boolean;
  },
  adminId: string
) => {
  const service = await prisma.service.create({
    data: {
      name: payload.name,
      description: payload.description,
      category: payload.category,
      basePrice: payload.basePrice,
      estimatedDurationHours: payload.estimatedDurationHours ?? 2.0,
      isAvailable: payload.isAvailable ?? true,
    },
  });

  await logAudit({
    userId: adminId,
    action: "SERVICE_CREATED",
    entity: "Service",
    entityId: service.id,
    details: payload,
  });

  await deleteCachePattern("services:*");

  return service;
};

export const getAllServices = async (query: {
  searchTerm?: string;
  category?: string;
  isAvailable?: string;
  page?: string;
  limit?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}) => {
  const cacheKey = `services:list:${JSON.stringify(query)}`;
  const cachedData = await getCache<any>(cacheKey);
  if (cachedData) {
    return cachedData;
  }

  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.max(1, Number(query.limit) || 10);
  const skip = (page - 1) * limit;
  const sortBy = query.sortBy || "createdAt";
  const sortOrder = query.sortOrder || "desc";

  const andConditions: Prisma.ServiceWhereInput[] = [{ isDeleted: false }];

  if (query.searchTerm) {
    andConditions.push({
      OR: [
        { name: { contains: query.searchTerm, mode: "insensitive" } },
        { description: { contains: query.searchTerm, mode: "insensitive" } },
        { category: { contains: query.searchTerm, mode: "insensitive" } },
      ],
    });
  }

  if (query.category) {
    andConditions.push({
      category: { equals: query.category, mode: "insensitive" },
    });
  }

  if (query.isAvailable !== undefined) {
    andConditions.push({
      isAvailable: query.isAvailable === "true",
    });
  }

  const whereCondition: Prisma.ServiceWhereInput = { AND: andConditions };

  const [services, total] = await Promise.all([
    prisma.service.findMany({
      where: whereCondition,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
    }),
    prisma.service.count({ where: whereCondition }),
  ]);

  const result = {
    services,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };

  // Cache in Redis for 5 minutes (300 seconds)
  await setCache(cacheKey, result, 300);

  return result;
};

export const getServiceById = async (id: string) => {
  const service = await prisma.service.findUnique({
    where: { id },
  });

  if (!service || service.isDeleted) {
    throw new AppError(404, "Service not found");
  }

  return service;
};

export const updateService = async (
  id: string,
  payload: Partial<{
    name: string;
    description: string;
    category: string;
    basePrice: number;
    estimatedDurationHours: number;
    isAvailable: boolean;
  }>,
  adminId: string
) => {
  const service = await prisma.service.findUnique({ where: { id } });
  if (!service || service.isDeleted) {
    throw new AppError(404, "Service not found");
  }

  const updated = await prisma.service.update({
    where: { id },
    data: payload,
  });

  await logAudit({
    userId: adminId,
    action: "SERVICE_UPDATED",
    entity: "Service",
    entityId: id,
    details: payload,
  });

  await deleteCachePattern("services:*");

  return updated;
};

export const deleteService = async (id: string, adminId: string) => {
  const service = await prisma.service.findUnique({ where: { id } });
  if (!service || service.isDeleted) {
    throw new AppError(404, "Service not found");
  }

  await prisma.service.update({
    where: { id },
    data: {
      isDeleted: true,
      deletedAt: new Date(),
    },
  });

  await logAudit({
    userId: adminId,
    action: "SERVICE_SOFT_DELETED",
    entity: "Service",
    entityId: id,
  });

  await deleteCachePattern("services:*");

  return { message: "Service deleted successfully" };
};
