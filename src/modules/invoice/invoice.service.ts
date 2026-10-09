import { Prisma } from "../../../prisma/generated/prisma/client";
import { InvoiceStatus, Role } from "../../../prisma/generated/prisma/enums";
import prisma from "../../lib/prisma";
import { AppError } from "../../utils/appError";
import { logAudit } from "../../utils/auditLogger";

export const getAllInvoices = async (query: {
  status?: InvoiceStatus;
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

  const whereCondition: Prisma.InvoiceWhereInput = {};
  if (query.status) {
    whereCondition.status = query.status;
  }

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where: whereCondition,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        serviceRequest: {
          select: {
            id: true,
            requestNumber: true,
            title: true,
            customer: { select: { id: true, name: true, email: true } },
          },
        },
        payments: true,
      },
    }),
    prisma.invoice.count({ where: whereCondition }),
  ]);

  return {
    invoices,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getMyInvoices = async (
  customerId: string,
  query: { page?: string; limit?: string }
) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.max(1, Number(query.limit) || 10);
  const skip = (page - 1) * limit;

  const whereCondition: Prisma.InvoiceWhereInput = {
    serviceRequest: { customerId },
  };

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where: whereCondition,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        serviceRequest: {
          select: {
            id: true,
            requestNumber: true,
            title: true,
            service: true,
          },
        },
        payments: true,
      },
    }),
    prisma.invoice.count({ where: whereCondition }),
  ]);

  return {
    invoices,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getInvoiceById = async (id: string, user: { id: string; role: Role }) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      serviceRequest: {
        include: {
          customer: { select: { id: true, name: true, email: true, phone: true } },
          service: true,
          technician: { include: { user: { select: { name: true, phone: true } } } },
        },
      },
      payments: true,
    },
  });

  if (!invoice) {
    throw new AppError(404, "Invoice not found");
  }

  if (
    user.role === Role.CUSTOMER &&
    invoice.serviceRequest.customerId !== user.id
  ) {
    throw new AppError(403, "Forbidden - This is not your invoice");
  }

  return invoice;
};

export const createInvoice = async (
  payload: {
    serviceRequestId: string;
    amount: number;
    tax?: number;
    dueDate?: string;
  },
  adminId: string
) => {
  const existing = await prisma.invoice.findUnique({
    where: { serviceRequestId: payload.serviceRequestId },
  });

  if (existing) {
    throw new AppError(409, "Invoice already exists for this service request");
  }

  const invCount = await prisma.invoice.count();
  const invoiceNumber = `INV-${(1000 + invCount + 1).toString()}`;
  const tax = payload.tax ?? Math.round(payload.amount * 0.1 * 100) / 100;
  const totalAmount = Math.round((payload.amount + tax) * 100) / 100;

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber,
      serviceRequestId: payload.serviceRequestId,
      amount: payload.amount,
      tax,
      totalAmount,
      status: InvoiceStatus.UNPAID,
      dueDate: payload.dueDate ? new Date(payload.dueDate) : undefined,
    },
  });

  await logAudit({
    userId: adminId,
    action: "INVOICE_CREATED",
    entity: "Invoice",
    entityId: invoice.id,
    details: { totalAmount: invoice.totalAmount },
  });

  return invoice;
};

export const cancelInvoice = async (id: string, adminId: string) => {
  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) {
    throw new AppError(404, "Invoice not found");
  }

  if (invoice.status === InvoiceStatus.PAID) {
    throw new AppError(400, "Cannot cancel an already paid invoice");
  }

  const updated = await prisma.invoice.update({
    where: { id },
    data: { status: InvoiceStatus.CANCELLED },
  });

  await logAudit({
    userId: adminId,
    action: "INVOICE_CANCELLED",
    entity: "Invoice",
    entityId: id,
  });

  return updated;
};
