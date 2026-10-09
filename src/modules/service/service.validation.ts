import { z } from "zod";

export const createServiceValidationSchema = z.object({
  name: z.string().min(2, "Service name must be at least 2 characters long"),
  description: z.string().min(5, "Description must be at least 5 characters long"),
  category: z.string().min(2, "Category is required"),
  basePrice: z.number().positive("Base price must be greater than 0"),
  estimatedDurationHours: z.number().positive().default(2.0),
  isAvailable: z.boolean().default(true),
});

export const updateServiceValidationSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().min(5).optional(),
  category: z.string().optional(),
  basePrice: z.number().positive().optional(),
  estimatedDurationHours: z.number().positive().optional(),
  isAvailable: z.boolean().optional(),
});
