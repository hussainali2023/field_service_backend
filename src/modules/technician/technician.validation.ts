import { z } from "zod";

export const createTechnicianValidationSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters long"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters long"),
  phone: z.string().optional(),
  skills: z.array(z.string()).min(1, "At least one skill is required"),
  experienceYears: z.number().int().nonnegative().default(1),
  hourlyRate: z.number().positive("Hourly rate must be greater than 0"),
  serviceArea: z.string().min(2, "Service area is required"),
  bio: z.string().optional(),
});

export const updateTechnicianValidationSchema = z.object({
  skills: z.array(z.string()).optional(),
  experienceYears: z.number().int().nonnegative().optional(),
  hourlyRate: z.number().positive().optional(),
  serviceArea: z.string().optional(),
  bio: z.string().optional(),
  isAvailable: z.boolean().optional(),
});
