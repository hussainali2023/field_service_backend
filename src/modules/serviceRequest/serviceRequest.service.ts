import { Prisma } from "../../../prisma/generated/prisma/client";
import { InvoiceStatus, RequestStatus, Role, UrgencyLevel } from "../../../prisma/generated/prisma/enums";
import prisma from "../../lib/prisma";
import { AppError } from "../../utils/appError";
import { logAudit } from "../../utils/auditLogger";

export const createServiceRequest = async (
  customerId: string,
  payload: {
    serviceId: string;
    title: string;
    description: string;
    address: string;
    urgency: UrgencyLevel;
    preferredDate: string;
  }
) => {
  const service = await prisma.service.findUnique({
    where: { id: payload.serviceId },
  });

  if (!service || service.isDeleted || !service.isAvailable) {
    throw new AppError(404, "Selected service is unavailable or does not exist");
  }

  const count = await prisma.serviceRequest.count();
  const requestNumber = `SR-${(1000 + count + 1).toString()}`;

  const request = await prisma.$transaction(async (tx) => {
    const sr = await tx.serviceRequest.create({
      data: {
        requestNumber,
        customerId,
        serviceId: payload.serviceId,
        title: payload.title,
        description: payload.description,
        address: payload.address,
        urgency: payload.urgency,
        preferredDate: new Date(payload.preferredDate),
        status: RequestStatus.REQUESTED,
        estimatedPrice: service.basePrice,
      },
      include: {
        service: true,
        customer: { select: { id: true, name: true, email: true, phone: true } },
      },
    });

    await tx.requestStatusLog.create({
      data: {
        serviceRequestId: sr.id,
        toStatus: RequestStatus.REQUESTED,
        changedByUserId: customerId,
        notes: "Service request submitted by customer",
      },
    });

    return sr;
  });

  await logAudit({
    userId: customerId,
    action: "SERVICE_REQUEST_CREATED",
    entity: "ServiceRequest",
    entityId: request.id,
    details: { requestNumber: request.requestNumber, serviceId: request.serviceId },
  });

  return request;
};

export const reviewServiceRequest = async (
  id: string,
  adminId: string,
  payload: {
    estimatedPrice: number;
    adminNotes?: string;
    urgency?: UrgencyLevel;
  }
) => {
  const request = await prisma.serviceRequest.findUnique({ where: { id } });
  if (!request || request.isDeleted) {
    throw new AppError(404, "Service request not found");
  }

  if (request.status !== RequestStatus.REQUESTED && request.status !== RequestStatus.REVIEWED) {
    throw new AppError(400, `Cannot review a request with status ${request.status}`);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const sr = await tx.serviceRequest.update({
      where: { id },
      data: {
        status: RequestStatus.REVIEWED,
        estimatedPrice: payload.estimatedPrice,
        adminNotes: payload.adminNotes,
        ...(payload.urgency ? { urgency: payload.urgency } : {}),
      },
      include: { service: true, customer: true },
    });

    await tx.requestStatusLog.create({
      data: {
        serviceRequestId: id,
        fromStatus: request.status,
        toStatus: RequestStatus.REVIEWED,
        changedByUserId: adminId,
        notes: payload.adminNotes || "Request reviewed by manager/admin",
      },
    });

    return sr;
  });

  await logAudit({
    userId: adminId,
    action: "SERVICE_REQUEST_REVIEWED",
    entity: "ServiceRequest",
    entityId: id,
    details: payload,
  });

  return updated;
};

export const assignTechnician = async (
  id: string,
  adminId: string,
  payload: {
    technicianId: string;
    scheduledDate: string;
    scheduledEndDate: string;
    notes?: string;
  }
) => {
  const request = await prisma.serviceRequest.findUnique({ where: { id } });
  if (!request || request.isDeleted) {
    throw new AppError(404, "Service request not found");
  }

  if (
    request.status === RequestStatus.COMPLETED ||
    request.status === RequestStatus.CANCELLED
  ) {
    throw new AppError(400, `Cannot assign technician to a ${request.status} request`);
  }

  const technician = await prisma.technicianProfile.findUnique({
    where: { id: payload.technicianId },
    include: { user: true },
  });

  if (!technician || technician.isDeleted || !technician.isAvailable) {
    throw new AppError(404, "Technician not found or currently unavailable");
  }

  const start = new Date(payload.scheduledDate);
  const end = new Date(payload.scheduledEndDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
    throw new AppError(400, "scheduledEndDate must be later than scheduledDate");
  }

  // Conflict Detection: check overlapping active assignments for this technician
  const conflict = await prisma.serviceRequest.findFirst({
    where: {
      technicianId: payload.technicianId,
      id: { not: id },
      isDeleted: false,
      status: {
        in: [
          RequestStatus.ASSIGNED,
          RequestStatus.SCHEDULED,
          RequestStatus.ON_THE_WAY,
          RequestStatus.IN_PROGRESS,
        ],
      },
      AND: [
        { scheduledDate: { lt: end } },
        { scheduledEndDate: { gt: start } },
      ],
    },
  });

  if (conflict) {
    throw new AppError(
      409,
      `Schedule conflict detected: Technician ${technician.user.name} is already assigned to work order ${conflict.requestNumber} during this time window (${conflict.scheduledDate?.toISOString()} to ${conflict.scheduledEndDate?.toISOString()}).`
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const sr = await tx.serviceRequest.update({
      where: { id },
      data: {
        technicianId: payload.technicianId,
        scheduledDate: start,
        scheduledEndDate: end,
        status: RequestStatus.SCHEDULED,
      },
      include: {
        technician: { include: { user: true } },
        customer: true,
        service: true,
      },
    });

    await tx.requestStatusLog.create({
      data: {
        serviceRequestId: id,
        fromStatus: request.status,
        toStatus: RequestStatus.SCHEDULED,
        changedByUserId: adminId,
        notes: payload.notes || `Assigned to ${technician.user.name} and scheduled`,
      },
    });

    return sr;
  });

  await logAudit({
    userId: adminId,
    action: "TECHNICIAN_ASSIGNED",
    entity: "ServiceRequest",
    entityId: id,
    details: {
      technicianId: payload.technicianId,
      scheduledDate: payload.scheduledDate,
      scheduledEndDate: payload.scheduledEndDate,
    },
  });

  return updated;
};

export const updateRequestStatus = async (
  id: string,
  user: { id: string; role: Role },
  payload: {
    status: RequestStatus;
    notes?: string;
    cancellationReason?: string;
  }
) => {
  const request = await prisma.serviceRequest.findUnique({
    where: { id },
    include: { service: true, technician: true },
  });

  if (!request || request.isDeleted) {
    throw new AppError(404, "Service request not found");
  }

  // Access check
  if (user.role === Role.CUSTOMER && request.customerId !== user.id) {
    throw new AppError(403, "Forbidden - This is not your service request");
  }

  if (
    user.role === Role.TECHNICIAN &&
    request.technician?.userId !== user.id
  ) {
    throw new AppError(403, "Forbidden - You are not assigned to this work order");
  }

  // Validate state transitions
  if (request.status === RequestStatus.COMPLETED) {
    throw new AppError(400, "Completed service requests cannot change status");
  }

  if (request.status === RequestStatus.CANCELLED) {
    throw new AppError(400, "Cancelled service requests cannot be modified");
  }

  // Customer can only CANCEL
  if (user.role === Role.CUSTOMER && payload.status !== RequestStatus.CANCELLED) {
    throw new AppError(403, "Customers can only cancel a service request");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const finalPrice =
      payload.status === RequestStatus.COMPLETED
        ? request.finalPrice || request.estimatedPrice || request.service.basePrice
        : request.finalPrice;

    const sr = await tx.serviceRequest.update({
      where: { id },
      data: {
        status: payload.status,
        finalPrice,
        cancellationReason: payload.cancellationReason || request.cancellationReason,
      },
      include: { service: true, technician: { include: { user: true } }, customer: true },
    });

    await tx.requestStatusLog.create({
      data: {
        serviceRequestId: id,
        fromStatus: request.status,
        toStatus: payload.status,
        changedByUserId: user.id,
        notes: payload.notes || `Status changed to ${payload.status}`,
      },
    });

    // Auto-create invoice if status is COMPLETED and invoice doesn't exist
    if (payload.status === RequestStatus.COMPLETED) {
      const existingInvoice = await tx.invoice.findUnique({ where: { serviceRequestId: id } });
      if (!existingInvoice) {
        const invCount = await tx.invoice.count();
        const invoiceNumber = `INV-${(1000 + invCount + 1).toString()}`;
        const amount = finalPrice || request.service.basePrice;
        const tax = Math.round(amount * 0.1 * 100) / 100;
        const totalAmount = Math.round((amount + tax) * 100) / 100;

        await tx.invoice.create({
          data: {
            invoiceNumber,
            serviceRequestId: id,
            amount,
            tax,
            totalAmount,
            status: InvoiceStatus.UNPAID,
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        });
      }
    }

    return sr;
  });

  await logAudit({
    userId: user.id,
    action: "STATUS_UPDATED",
    entity: "ServiceRequest",
    entityId: id,
    details: { from: request.status, to: payload.status },
  });

  return updated;
};

export const submitServiceReport = async (
  id: string,
  user: { id: string; role: Role },
  payload: {
    serviceReport: string;
    partsUsed?: string;
    finalPrice: number;
  }
) => {
  const request = await prisma.serviceRequest.findUnique({
    where: { id },
    include: { technician: true, service: true },
  });

  if (!request || request.isDeleted) {
    throw new AppError(404, "Service request not found");
  }

  if (user.role === Role.TECHNICIAN && request.technician?.userId !== user.id) {
    throw new AppError(403, "You can only submit reports for your assigned work orders");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const sr = await tx.serviceRequest.update({
      where: { id },
      data: {
        serviceReport: payload.serviceReport,
        partsUsed: payload.partsUsed,
        finalPrice: payload.finalPrice,
        status: RequestStatus.COMPLETED,
      },
      include: { service: true, customer: true, technician: true },
    });

    await tx.requestStatusLog.create({
      data: {
        serviceRequestId: id,
        fromStatus: request.status,
        toStatus: RequestStatus.COMPLETED,
        changedByUserId: user.id,
        notes: "Technician submitted final service report and completed work order",
      },
    });

    // Create or update invoice with final price
    const existingInvoice = await tx.invoice.findUnique({ where: { serviceRequestId: id } });
    const tax = Math.round(payload.finalPrice * 0.1 * 100) / 100;
    const totalAmount = Math.round((payload.finalPrice + tax) * 100) / 100;

    if (!existingInvoice) {
      const invCount = await tx.invoice.count();
      await tx.invoice.create({
        data: {
          invoiceNumber: `INV-${(1000 + invCount + 1).toString()}`,
          serviceRequestId: id,
          amount: payload.finalPrice,
          tax,
          totalAmount,
          status: InvoiceStatus.UNPAID,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
    } else if (existingInvoice.status === InvoiceStatus.UNPAID) {
      await tx.invoice.update({
        where: { id: existingInvoice.id },
        data: {
          amount: payload.finalPrice,
          tax,
          totalAmount,
        },
      });
    }

    return sr;
  });

  await logAudit({
    userId: user.id,
    action: "SERVICE_REPORT_SUBMITTED",
    entity: "ServiceRequest",
    entityId: id,
    details: { finalPrice: payload.finalPrice },
  });

  return updated;
};

export const getAllServiceRequests = async (query: {
  searchTerm?: string;
  status?: RequestStatus;
  urgency?: UrgencyLevel;
  serviceId?: string;
  technicianId?: string;
  customerId?: string;
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

  const andConditions: Prisma.ServiceRequestWhereInput[] = [{ isDeleted: false }];

  if (query.searchTerm) {
    andConditions.push({
      OR: [
        { requestNumber: { contains: query.searchTerm, mode: "insensitive" } },
        { title: { contains: query.searchTerm, mode: "insensitive" } },
        { description: { contains: query.searchTerm, mode: "insensitive" } },
        { address: { contains: query.searchTerm, mode: "insensitive" } },
        { customer: { name: { contains: query.searchTerm, mode: "insensitive" } } },
      ],
    });
  }

  if (query.status) andConditions.push({ status: query.status });
  if (query.urgency) andConditions.push({ urgency: query.urgency });
  if (query.serviceId) andConditions.push({ serviceId: query.serviceId });
  if (query.technicianId) andConditions.push({ technicianId: query.technicianId });
  if (query.customerId) andConditions.push({ customerId: query.customerId });

  const whereCondition: Prisma.ServiceRequestWhereInput = { AND: andConditions };

  const [requests, total] = await Promise.all([
    prisma.serviceRequest.findMany({
      where: whereCondition,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        service: true,
        customer: { select: { id: true, name: true, email: true, phone: true } },
        technician: {
          include: {
            user: { select: { id: true, name: true, phone: true, email: true } },
          },
        },
        invoice: true,
      },
    }),
    prisma.serviceRequest.count({ where: whereCondition }),
  ]);

  return {
    requests,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getMyCustomerRequests = async (
  customerId: string,
  query: { page?: string; limit?: string; status?: RequestStatus }
) => {
  return getAllServiceRequests({ ...query, customerId });
};

export const getMyTechnicianAssignments = async (
  userId: string,
  query: { page?: string; limit?: string; status?: RequestStatus }
) => {
  const profile = await prisma.technicianProfile.findUnique({ where: { userId } });
  if (!profile) {
    throw new AppError(404, "Technician profile not found for current user");
  }

  return getAllServiceRequests({ ...query, technicianId: profile.id });
};

export const getServiceRequestById = async (id: string, user: { id: string; role: Role }) => {
  const request = await prisma.serviceRequest.findUnique({
    where: { id },
    include: {
      service: true,
      customer: { select: { id: true, name: true, email: true, phone: true } },
      technician: {
        include: {
          user: { select: { id: true, name: true, phone: true, email: true } },
        },
      },
      invoice: {
        include: { payments: true },
      },
      review: true,
      statusLogs: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!request || request.isDeleted) {
    throw new AppError(404, "Service request not found");
  }

  if (user.role === Role.CUSTOMER && request.customerId !== user.id) {
    throw new AppError(403, "Forbidden - You do not have permission to view this request");
  }

  if (
    user.role === Role.TECHNICIAN &&
    request.technician?.userId !== user.id
  ) {
    throw new AppError(403, "Forbidden - You are not assigned to this service request");
  }

  return request;
};

export const deleteServiceRequest = async (id: string, user: { id: string; role: Role }) => {
  const request = await prisma.serviceRequest.findUnique({ where: { id } });
  if (!request || request.isDeleted) {
    throw new AppError(404, "Service request not found");
  }

  if (user.role === Role.CUSTOMER && request.customerId !== user.id) {
    throw new AppError(403, "Forbidden - You do not own this service request");
  }

  await prisma.serviceRequest.update({
    where: { id },
    data: {
      isDeleted: true,
      deletedAt: new Date(),
    },
  });

  await logAudit({
    userId: user.id,
    action: "SERVICE_REQUEST_DELETED",
    entity: "ServiceRequest",
    entityId: id,
  });

  return { message: "Service request cancelled / deleted successfully" };
};
