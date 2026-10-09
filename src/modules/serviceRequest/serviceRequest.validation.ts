import { z } from "zod";
import { RequestStatus, UrgencyLevel } from "../../../prisma/generated/prisma/enums";

export const createServiceRequestValidationSchema = z.object({
  serviceId: z.string().uuid("Invalid service ID"),
  title: z.string().min(3, "Title must be at least 3 characters long"),
  description: z.string().min(10, "Description must be at least 10 characters long"),
  address: z.string().min(5, "Address must be at least 5 characters long"),
  urgency: z.nativeEnum(UrgencyLevel).default(UrgencyLevel.MEDIUM),
  preferredDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Valid ISO date format required for preferredDate",
  }),
});

export const reviewServiceRequestValidationSchema = z.object({
  estimatedPrice: z.number().positive("Estimated price must be positive"),
  adminNotes: z.string().optional(),
  urgency: z.nativeEnum(UrgencyLevel).optional(),
});

export const assignTechnicianValidationSchema = z.object({
  technicianId: z.string().uuid("Invalid technician ID"),
  scheduledDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Valid ISO date required for scheduledDate",
  }),
  scheduledEndDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Valid ISO date required for scheduledEndDate",
  }),
  notes: z.string().optional(),
});

export const updateStatusValidationSchema = z.object({
  status: z.nativeEnum(RequestStatus),
  notes: z.string().optional(),
  cancellationReason: z.string().optional(),
});

export const submitReportValidationSchema = z.object({
  serviceReport: z.string().min(10, "Service report must be at least 10 characters long"),
  partsUsed: z.string().optional(),
  finalPrice: z.number().positive("Final price must be greater than 0"),
});
