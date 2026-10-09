import { Router } from "express";
import { Role } from "../../../prisma/generated/prisma/enums";
import { auth } from "../../middleware/auth";
import { validateRequest } from "../../middleware/validateRequest";
import * as UserController from "./user.controller";
import {
  updateProfileValidationSchema,
  updateUserStatusValidationSchema,
} from "./user.validation";

const router = Router();

router.get("/", auth(Role.ADMIN), UserController.getAllUsers);

router.get("/:id", auth(), UserController.getUserById);

router.patch(
  "/me",
  auth(),
  validateRequest(updateProfileValidationSchema),
  UserController.updateProfile
);

router.patch(
  "/:id/status",
  auth(Role.ADMIN),
  validateRequest(updateUserStatusValidationSchema),
  UserController.updateUserStatus
);

router.delete("/:id", auth(Role.ADMIN), UserController.softDeleteUser);

export const UserRoutes = router;
