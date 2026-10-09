import { Router } from "express";
import { Role } from "../../../prisma/generated/prisma/enums";
import { auth } from "../../middleware/auth";
import { validateRequest } from "../../middleware/validateRequest";
import * as ReviewController from "./review.controller";
import { createReviewValidationSchema } from "./review.validation";

const router = Router();

router.post(
  "/",
  auth(Role.CUSTOMER),
  validateRequest(createReviewValidationSchema),
  ReviewController.createReview
);

router.get("/", ReviewController.getAllReviews);

router.get("/technician/:id", ReviewController.getTechnicianReviews);

export const ReviewRoutes:Router = router;
