import { z } from "zod";

export const createInvoiceValidationSchema = z.object({
  serviceRequestId: z.string().uuid("Invalid service request ID"),
  amount: z.number().positive("Amount must be greater than 0"),
  tax: z.number().nonnegative().default(0),
  dueDate: z.string().optional(),
});
