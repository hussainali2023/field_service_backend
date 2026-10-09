import type { NextFunction, Request, Response } from "express";
import { Role } from "../../prisma/generated/prisma/enums";
import prisma from "../lib/prisma";
import { AppError } from "../utils/appError";
import { catchAsync } from "../utils/catchAsync";
import { verifyAccessToken } from "../utils/jwt";

export const auth = (...roles: Role[]) => {
  return catchAsync(async (req: Request, _res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new AppError(401, "Unauthorized - No bearer token provided");
    }

    const token = authHeader.slice(7);

    try {
      const decoded = verifyAccessToken(token);

      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
      });

      if (!user || user.isDeleted) {
        throw new AppError(401, "Unauthorized - User no longer exists");
      }

      if (user.status === "BLOCKED" || user.status === "SUSPENDED") {
        throw new AppError(403, `Forbidden - Account is ${user.status.toLowerCase()}`);
      }

      if (roles.length > 0 && !roles.includes(decoded.role)) {
        throw new AppError(403, `Forbidden - Requires one of roles: [${roles.join(", ")}]`);
      }

      req.user = decoded;
      next();
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(401, "Unauthorized - Invalid or expired token");
    }
  });
};
