import { InvoiceStatus, RequestStatus, Role } from "../../../prisma/generated/prisma/enums";
import prisma from "../../lib/prisma";
import { getCache, setCache } from "../../lib/redis";

export const getDashboardStats = async () => {
  const cacheKey = "admin:dashboard:stats";
  const cached = await getCache<any>(cacheKey);
  if (cached) {
    return cached;
  }

  const [
    totalUsers,
    customersCount,
    techniciansCount,
    adminsCount,
    totalRequests,
    statusCounts,
    revenueData,
    unpaidInvoices,
    recentRequests,
  ] = await Promise.all([
    prisma.user.count({ where: { isDeleted: false } }),
    prisma.user.count({ where: { role: Role.CUSTOMER, isDeleted: false } }),
    prisma.technicianProfile.count({ where: { isDeleted: false } }),
    prisma.user.count({ where: { role: Role.ADMIN, isDeleted: false } }),
    prisma.serviceRequest.count({ where: { isDeleted: false } }),
    prisma.serviceRequest.groupBy({
      by: ["status"],
      _count: { id: true },
      where: { isDeleted: false },
    }),
    prisma.payment.aggregate({
      where: { status: "COMPLETED" },
      _sum: { amount: true },
      _count: { id: true },
    }),
    prisma.invoice.aggregate({
      where: { status: InvoiceStatus.UNPAID },
      _sum: { totalAmount: true },
      _count: { id: true },
    }),
    prisma.serviceRequest.findMany({
      where: { isDeleted: false },
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        customer: { select: { id: true, name: true, email: true } },
        service: { select: { id: true, name: true } },
        technician: { include: { user: { select: { name: true } } } },
      },
    }),
  ]);

  const requestsByStatus = statusCounts.reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = item._count.id;
    return acc;
  }, {});

  return {
    overview: {
      totalUsers,
      customersCount,
      techniciansCount,
      adminsCount,
      totalRequests,
      completedRequests: requestsByStatus[RequestStatus.COMPLETED] ?? 0,
      inProgressRequests: requestsByStatus[RequestStatus.IN_PROGRESS] ?? 0,
      totalRevenue: revenueData._sum.amount ?? 0,
      totalCompletedPayments: revenueData._count.id ?? 0,
      unpaidInvoicesCount: unpaidInvoices._count.id ?? 0,
      unpaidInvoicesTotal: unpaidInvoices._sum.totalAmount ?? 0,
    },
    requestsByStatus,
    recentRequests,
  };

  await setCache(cacheKey, result, 120);

  return result;
};

export const getAuditLogs = async (query: {
  action?: string;
  entity?: string;
  page?: string;
  limit?: string;
}) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.max(1, Number(query.limit) || 20);
  const skip = (page - 1) * limit;

  const whereCondition: any = {};
  if (query.action) whereCondition.action = { contains: query.action, mode: "insensitive" };
  if (query.entity) whereCondition.entity = { contains: query.entity, mode: "insensitive" };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where: whereCondition,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    }),
    prisma.auditLog.count({ where: whereCondition }),
  ]);

  return {
    logs,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};
