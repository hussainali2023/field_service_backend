import { Router } from "express";
import { Role } from "../../../prisma/generated/prisma/enums";
import { auth } from "../../middleware/auth";
import { validateRequest } from "../../middleware/validateRequest";
import * as ServiceRequestController from "./serviceRequest.controller";
import {
  assignTechnicianValidationSchema,
  createServiceRequestValidationSchema,
  reviewServiceRequestValidationSchema,
  submitReportValidationSchema,
  updateStatusValidationSchema,
} from "./serviceRequest.validation";

const router = Router();

router.post(
  "/",
  auth(Role.CUSTOMER),
  validateRequest(createServiceRequestValidationSchema),
  ServiceRequestController.createServiceRequest
);

router.get("/", auth(Role.ADMIN), ServiceRequestController.getAllServiceRequests);

router.get(
  "/my-requests",
  auth(Role.CUSTOMER),
  ServiceRequestController.getMyCustomerRequests
);

router.get(
  "/my-assignments",
  auth(Role.TECHNICIAN),
  ServiceRequestController.getMyTechnicianAssignments
);

router.get("/:id", auth(), ServiceRequestController.getServiceRequestById);

router.patch(
  "/:id/review",
  auth(Role.ADMIN),
  validateRequest(reviewServiceRequestValidationSchema),
  ServiceRequestController.reviewServiceRequest
);

router.post(
  "/:id/assign",
  auth(Role.ADMIN),
  validateRequest(assignTechnicianValidationSchema),
  ServiceRequestController.assignTechnician
);

router.patch(
  "/:id/status",
  auth(Role.ADMIN, Role.TECHNICIAN, Role.CUSTOMER),
  validateRequest(updateStatusValidationSchema),
  ServiceRequestController.updateRequestStatus
);

router.post(
  "/:id/report",
  auth(Role.ADMIN, Role.TECHNICIAN),
  validateRequest(submitReportValidationSchema),
  ServiceRequestController.submitServiceReport
);

router.delete("/:id", auth(), ServiceRequestController.deleteServiceRequest);

export const ServiceRequestRoutes:Router = router;
