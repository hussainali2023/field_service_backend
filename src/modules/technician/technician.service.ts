import bcrypt from "bcryptjs";
import { Prisma } from "../../../prisma/generated/prisma/client";
import { RequestStatus, Role, UserStatus } from "../../../prisma/generated/prisma/enums";
import config from "../../config";
import prisma from "../../lib/prisma";
import { AppError } from "../../utils/appError";
import { logAudit } from "../../utils/auditLogger";

export const createTechnician = async (
  payload: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    skills: string[];
    experienceYears?: number;
    hourlyRate: number;
    serviceArea: string;
    bio?: string;
  },
  adminId: string
) => {
  const existingUser = await prisma.user.findUnique({
    where: { email: payload.email.toLowerCase() },
  });

  if (existingUser) {
    throw new AppError(409, "User with this email already exists");
  }

  const hashedPassword = await bcrypt.hash(payload.password, config.BCRYPT_SALT_ROUNDS);

  const technician = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: payload.name,
        email: payload.email.toLowerCase(),
        password: hashedPassword,
        phone: payload.phone,
        role: Role.TECHNICIAN,
        status: UserStatus.ACTIVE,
      },
    });

    const profile = await tx.technicianProfile.create({
      data: {
        userId: user.id,
        skills: payload.skills,
        experienceYears: payload.experienceYears ?? 1,
        hourlyRate: payload.hourlyRate,
        serviceArea: payload.serviceArea,
        bio: payload.bio,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            status: true,
          },
        },
      },
    });

    return profile;
  });

  await logAudit({
    userId: adminId,
    action: "TECHNICIAN_CREATED",
    entity: "TechnicianProfile",
    entityId: technician.id,
    details: { email: payload.email, skills: payload.skills },
  });

  return technician;
};

export const getAllTechnicians = async (query: {
  searchTerm?: string;
  skill?: string;
  serviceArea?: string;
  isAvailable?: string;
  minRating?: string;
  page?: string;
  limit?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.max(1, Number(query.limit) || 10);
  const skip = (page - 1) * limit;
  const sortBy = query.sortBy || "rating";
  const sortOrder = query.sortOrder || "desc";

  const andConditions: Prisma.TechnicianProfileWhereInput[] = [
    { isDeleted: false },
    { user: { isDeleted: false, status: UserStatus.ACTIVE } },
  ];

  if (query.searchTerm) {
    andConditions.push({
      OR: [
        { user: { name: { contains: query.searchTerm, mode: "insensitive" } } },
        { user: { email: { contains: query.searchTerm, mode: "insensitive" } } },
        { serviceArea: { contains: query.searchTerm, mode: "insensitive" } },
      ],
    });
  }

  if (query.skill) {
    andConditions.push({
      skills: { has: query.skill },
    });
  }

  if (query.serviceArea) {
    andConditions.push({
      serviceArea: { contains: query.serviceArea, mode: "insensitive" },
    });
  }

  if (query.isAvailable !== undefined) {
    andConditions.push({
      isAvailable: query.isAvailable === "true",
    });
  }

  if (query.minRating) {
    andConditions.push({
      rating: { gte: Number(query.minRating) },
    });
  }

  const whereCondition: Prisma.TechnicianProfileWhereInput = { AND: andConditions };

  const [technicians, total] = await Promise.all([
    prisma.technicianProfile.findMany({
      where: whereCondition,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            avatar: true,
          },
        },
      },
    }),
    prisma.technicianProfile.count({ where: whereCondition }),
  ]);

  return {
    technicians,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getTechnicianById = async (id: string) => {
  const technician = await prisma.technicianProfile.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          avatar: true,
          status: true,
        },
      },
      reviews: {
        take: 10,
        orderBy: { createdAt: "desc" },
        include: {
          customer: { select: { id: true, name: true, avatar: true } },
        },
      },
      assignedRequests: {
        where: {
          status: {
            in: [
              RequestStatus.ASSIGNED,
              RequestStatus.SCHEDULED,
              RequestStatus.ON_THE_WAY,
              RequestStatus.IN_PROGRESS,
            ],
          },
        },
        select: {
          id: true,
          requestNumber: true,
          scheduledDate: true,
          scheduledEndDate: true,
          status: true,
        },
      },
    },
  });

  if (!technician || technician.isDeleted) {
    throw new AppError(404, "Technician profile not found");
  }

  return technician;
};

export const updateTechnician = async (
  id: string,
  payload: {
    skills?: string[];
    experienceYears?: number;
    hourlyRate?: number;
    serviceArea?: string;
    bio?: string;
    isAvailable?: boolean;
  },
  requesterUser: { id: string; role: Role }
) => {
  const technician = await prisma.technicianProfile.findUnique({
    where: { id },
    include: { user: true },
  });

  if (!technician || technician.isDeleted) {
    throw new AppError(404, "Technician profile not found");
  }

  if (requesterUser.role !== Role.ADMIN && technician.userId !== requesterUser.id) {
    throw new AppError(403, "You can only update your own technician profile");
  }

  const updated = await prisma.technicianProfile.update({
    where: { id },
    data: payload,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
    },
  });

  await logAudit({
    userId: requesterUser.id,
    action: "TECHNICIAN_UPDATED",
    entity: "TechnicianProfile",
    entityId: id,
    details: payload,
  });

  return updated;
};

export const checkTechnicianAvailability = async (
  id: string,
  startDateStr: string,
  endDateStr: string
) => {
  const technician = await prisma.technicianProfile.findUnique({ where: { id } });
  if (!technician || technician.isDeleted) {
    throw new AppError(404, "Technician not found");
  }

  const start = new Date(startDateStr);
  const end = new Date(endDateStr);

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
    throw new AppError(400, "Valid startDate and endDate (where endDate > startDate) are required");
  }

  // Conflict query: overlapping work orders
  const conflicts = await prisma.serviceRequest.findMany({
    where: {
      technicianId: id,
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
    select: {
      id: true,
      requestNumber: true,
      scheduledDate: true,
      scheduledEndDate: true,
      status: true,
    },
  });

  return {
    technicianId: id,
    isAvailable: conflicts.length === 0 && technician.isAvailable,
    conflicts,
  };
};
