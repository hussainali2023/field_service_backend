import { z } from "zod";

export const createCheckoutSessionValidationSchema = z.object({
  invoiceId: z.string().uuid("Invalid invoice ID"),
});

export const verifyPaymentValidationSchema = z.object({
  sessionId: z.string().min(1, "Session ID is required"),
  invoiceId: z.string().uuid().optional(),
});
