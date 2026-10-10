import { z } from "zod";
import { Role, UserStatus } from "../../../prisma/generated/prisma/enums";

export const updateProfileValidationSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
  avatar: z.string().optional(),
});

export const updateUserStatusValidationSchema = z.object({
  status: z.nativeEnum(UserStatus),
});

export const createUserValidationSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  phone: z.string().optional(),
  role: z.nativeEnum(Role).optional().default(Role.CUSTOMER),
  skills: z.array(z.string()).optional(),
  experienceYears: z.number().optional(),
  hourlyRate: z.number().optional(),
  serviceArea: z.string().optional(),
});
