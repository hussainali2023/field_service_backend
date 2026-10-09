import { Router } from "express";
import { Role } from "../../../prisma/generated/prisma/enums";
import { auth } from "../../middleware/auth";
import { validateRequest } from "../../middleware/validateRequest";
import * as PaymentController from "./payment.controller";
import {
  createCheckoutSessionValidationSchema,
  verifyPaymentValidationSchema,
} from "./payment.validation";

const router = Router();

router.post(
  "/create-checkout-session",
  auth(Role.CUSTOMER),
  validateRequest(createCheckoutSessionValidationSchema),
  PaymentController.createCheckoutSession
);

router.post(
  "/verify",
  auth(Role.CUSTOMER, Role.ADMIN),
  validateRequest(verifyPaymentValidationSchema),
  PaymentController.verifyPayment
);

router.get("/:id", auth(), PaymentController.getPaymentById);

export const PaymentRoutes:Router = router;
