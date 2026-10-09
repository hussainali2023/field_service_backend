import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";
import { AppError } from "../utils/appError";
import { catchAsync } from "../utils/catchAsync";

export const validateRequest = (schema: ZodSchema) => {
  return catchAsync(async (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body ?? {});

    if (!result.success) {
      const errorMessages = result.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      }));
      throw new AppError(400, "Validation failed", errorMessages);
    }

    req.body = result.data;
    next();
  });
};
