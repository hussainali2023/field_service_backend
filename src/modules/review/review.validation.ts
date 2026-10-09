import { z } from "zod";

export const createReviewValidationSchema = z.object({
  serviceRequestId: z.string().uuid("Invalid service request ID"),
  rating: z.number().int().min(1, "Rating must be at least 1").max(5, "Rating cannot exceed 5"),
  comment: z.string().min(3, "Comment must be at least 3 characters long"),
});
