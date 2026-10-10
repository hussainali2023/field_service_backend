import { z } from "zod";

export const registerValidationSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters long"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters long"),
  phone: z.string().optional(),
  role: z.enum(["CUSTOMER", "TECHNICIAN"]).optional().default("CUSTOMER"),
  skills: z.array(z.string()).optional(),
  experienceYears: z.number().optional(),
  hourlyRate: z.number().optional(),
  serviceArea: z.string().optional(),
});

export const loginValidationSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const googleLoginValidationSchema = z.object({
  idToken: z.string().optional(),
  email: z.string().email("Invalid email address").optional(),
  name: z.string().optional(),
});

export const refreshTokenValidationSchema = z.object({
  refreshToken: z.string().optional(),
});

export const changePasswordValidationSchema = z.object({
  oldPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters long"),
});

export const forgotPasswordValidationSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const resetPasswordValidationSchema = z.object({
  email: z.string().email("Invalid email address"),
  token: z.string().min(1, "Reset token is required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters long"),
});
