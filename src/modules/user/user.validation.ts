import { z } from "zod";
import { UserStatus } from "../../../prisma/generated/prisma/enums";

export const updateProfileValidationSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
  avatar: z.string().url().optional(),
});

export const updateUserStatusValidationSchema = z.object({
  status: z.nativeEnum(UserStatus),
});
