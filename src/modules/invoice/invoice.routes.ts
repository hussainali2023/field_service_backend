import { Router } from "express";
import { Role } from "../../../prisma/generated/prisma/enums";
import { auth } from "../../middleware/auth";
import { validateRequest } from "../../middleware/validateRequest";
import * as InvoiceController from "./invoice.controller";
import { createInvoiceValidationSchema } from "./invoice.validation";

const router = Router();

router.get("/", auth(Role.ADMIN), InvoiceController.getAllInvoices);

router.get("/my-invoices", auth(Role.CUSTOMER), InvoiceController.getMyInvoices);

router.get("/:id", auth(), InvoiceController.getInvoiceById);

router.post(
  "/",
  auth(Role.ADMIN),
  validateRequest(createInvoiceValidationSchema),
  InvoiceController.createInvoice
);

router.patch("/:id/cancel", auth(Role.ADMIN), InvoiceController.cancelInvoice);

export const InvoiceRoutes = router;
