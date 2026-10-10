import { Router } from "express";
import { auth } from "../../middleware/auth";
import { authLimiter } from "../../middleware/rateLimiter";
import { validateRequest } from "../../middleware/validateRequest";
import * as AuthController from "./auth.controller";
import {
  changePasswordValidationSchema,
  forgotPasswordValidationSchema,
  googleLoginValidationSchema,
  loginValidationSchema,
  refreshTokenValidationSchema,
  registerValidationSchema,
  resetPasswordValidationSchema,
} from "./auth.validation";

const router = Router();

router.post(
  "/register",
  authLimiter,
  validateRequest(registerValidationSchema),
  AuthController.register
);

router.post(
  "/login",
  authLimiter,
  validateRequest(loginValidationSchema),
  AuthController.login
);

router.post(
  "/google",
  authLimiter,
  validateRequest(googleLoginValidationSchema),
  AuthController.googleLogin
);

router.post(
  "/refresh-token",
  validateRequest(refreshTokenValidationSchema),
  AuthController.refreshToken
);

router.get("/me", auth(), AuthController.getMe);

router.post(
  "/change-password",
  auth(),
  validateRequest(changePasswordValidationSchema),
  AuthController.changePassword
);

router.post(
  "/forgot-password",
  authLimiter,
  validateRequest(forgotPasswordValidationSchema),
  AuthController.forgotPassword
);

router.post(
  "/reset-password",
  authLimiter,
  validateRequest(resetPasswordValidationSchema),
  AuthController.resetPassword
);

export const AuthRoutes: Router = router;
