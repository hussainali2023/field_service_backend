import { Router } from "express";
import { Role } from "../../../prisma/generated/prisma/enums";
import { auth } from "../../middleware/auth";
import { validateRequest } from "../../middleware/validateRequest";
import * as ServiceController from "./service.controller";
import {
  createServiceValidationSchema,
  updateServiceValidationSchema,
} from "./service.validation";

const router = Router();

router.post(
  "/",
  auth(Role.ADMIN),
  validateRequest(createServiceValidationSchema),
  ServiceController.createService
);

router.get("/", ServiceController.getAllServices);

router.get("/:id", ServiceController.getServiceById);

router.patch(
  "/:id",
  auth(Role.ADMIN),
  validateRequest(updateServiceValidationSchema),
  ServiceController.updateService
);

router.delete("/:id", auth(Role.ADMIN), ServiceController.deleteService);

export const ServiceRoutes:Router = router;
