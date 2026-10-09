import { Router } from "express";
import { Role } from "../../../prisma/generated/prisma/enums";
import { auth } from "../../middleware/auth";
import * as AdminController from "./admin.controller";

const router = Router();

router.get("/dashboard-stats", auth(Role.ADMIN), AdminController.getDashboardStats);
router.get("/audit-logs", auth(Role.ADMIN), AdminController.getAuditLogs);

export const AdminRoutes: Router = router;
