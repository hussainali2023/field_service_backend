import { Prisma } from "../../../prisma/generated/prisma/client";
import { RequestStatus } from "../../../prisma/generated/prisma/enums";
import prisma from "../../lib/prisma";
import { AppError } from "../../utils/appError";
import { logAudit } from "../../utils/auditLogger";

export const createReview = async (
  customerId: string,
  payload: {
    serviceRequestId: string;
    rating: number;
    comment: string;
  }
) => {
  const serviceRequest = await prisma.serviceRequest.findUnique({
    where: { id: payload.serviceRequestId },
    include: { review: true },
  });

  if (!serviceRequest) {
    throw new AppError(404, "Service request not found");
  }

  if (serviceRequest.customerId !== customerId) {
    throw new AppError(403, "Forbidden - You can only review your own service requests");
  }

  if (serviceRequest.status !== RequestStatus.COMPLETED) {
    throw new AppError(400, "Can only submit a review for completed service requests");
  }

  if (serviceRequest.review) {
    throw new AppError(409, "A review has already been submitted for this service request");
  }

  if (!serviceRequest.technicianId) {
    throw new AppError(400, "Cannot review a request without an assigned technician");
  }

  const technicianId = serviceRequest.technicianId;

  const review = await prisma.$transaction(async (tx) => {
    const rev = await tx.review.create({
      data: {
        serviceRequestId: payload.serviceRequestId,
        customerId,
        technicianId,
        rating: payload.rating,
        comment: payload.comment,
      },
      include: {
        customer: { select: { id: true, name: true, avatar: true } },
      },
    });

    // Recalculate technician rating & review count
    const agg = await tx.review.aggregate({
      where: { technicianId },
      _avg: { rating: true },
      _count: { rating: true },
    });

    const newAvg = agg._avg.rating ? Math.round(agg._avg.rating * 10) / 10 : 5.0;
    const newCount = agg._count.rating ?? 0;

    await tx.technicianProfile.update({
      where: { id: technicianId },
      data: {
        rating: newAvg,
        reviewCount: newCount,
      },
    });

    return rev;
  });

  await logAudit({
    userId: customerId,
    action: "REVIEW_CREATED",
    entity: "Review",
    entityId: review.id,
    details: { rating: payload.rating, technicianId },
  });

  return review;
};

export const getAllReviews = async (query: {
  technicianId?: string;
  minRating?: string;
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

  const whereCondition: Prisma.ReviewWhereInput = {};
  if (query.technicianId) whereCondition.technicianId = query.technicianId;
  if (query.minRating) whereCondition.rating = { gte: Number(query.minRating) };

  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where: whereCondition,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        customer: { select: { id: true, name: true, avatar: true } },
        technician: {
          include: { user: { select: { name: true } } },
        },
      },
    }),
    prisma.review.count({ where: whereCondition }),
  ]);

  return {
    reviews,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getTechnicianReviews = async (
  technicianId: string,
  query: { page?: string; limit?: string }
) => {
  return getAllReviews({ ...query, technicianId });
};
