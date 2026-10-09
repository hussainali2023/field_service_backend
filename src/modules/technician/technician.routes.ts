import { Router } from "express";
import { Role } from "../../../prisma/generated/prisma/enums";
import { auth } from "../../middleware/auth";
import { validateRequest } from "../../middleware/validateRequest";
import * as TechnicianController from "./technician.controller";
import {
  createTechnicianValidationSchema,
  updateTechnicianValidationSchema,
} from "./technician.validation";

const router = Router();

router.post(
  "/",
  auth(Role.ADMIN),
  validateRequest(createTechnicianValidationSchema),
  TechnicianController.createTechnician
);

router.get("/", TechnicianController.getAllTechnicians);

router.get("/:id/availability", TechnicianController.checkTechnicianAvailability);

router.get("/:id", TechnicianController.getTechnicianById);

router.patch(
  "/:id",
  auth(Role.ADMIN, Role.TECHNICIAN),
  validateRequest(updateTechnicianValidationSchema),
  TechnicianController.updateTechnician
);

export const TechnicianRoutes:Router = router;
