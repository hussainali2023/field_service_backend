import type { ErrorRequestHandler } from "express";
import jwt from "jsonwebtoken";
import { ZodError } from "zod";
import { PrismaClientKnownRequestError, PrismaClientValidationError } from "@prisma/client/runtime/client";
import config from "../config";
import { AppError } from "../utils/appError";

export const globalErrorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  let statusCode = 500;
  let message = "Something went wrong";
  let errors: unknown[] = [];

  if (err instanceof ZodError) {
    statusCode = 400;
    message = "Validation failed";
    errors = err.issues.map((i) => ({
      field: i.path.join("."),
      message: i.message,
    }));
  } else if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    if (Array.isArray(err.errorDetails)) {
      errors = err.errorDetails;
    } else if (err.errorDetails) {
      errors = [err.errorDetails];
    }
  } else if (err instanceof PrismaClientKnownRequestError) {
    switch (err.code) {
      case "P2002": {
        statusCode = 409;
        const target = (err.meta?.target as string[] | undefined)?.join(", ") ?? "field";
        message = `Duplicate key error: Unique constraint failed on ${target}`;
        errors = [{ code: err.code, target }];
        break;
      }
      case "P2025": {
        statusCode = 404;
        message = "Requested record not found";
        errors = [{ code: err.code }];
        break;
      }
      case "P2003": {
        statusCode = 400;
        message = "Related record constraint failed (Foreign Key violation)";
        errors = [{ code: err.code }];
        break;
      }
      default: {
        statusCode = 400;
        message = `Database error: ${err.message}`;
        errors = [{ code: err.code }];
      }
    }
  } else if (err instanceof PrismaClientValidationError) {
    statusCode = 400;
    message = "Invalid database query payload or missing required fields";
    errors = [{ error: err.message }];
  } else if (err instanceof jwt.TokenExpiredError) {
    statusCode = 401;
    message = "Token has expired, please log in again";
    errors = [{ error: "TOKEN_EXPIRED" }];
  } else if (err instanceof jwt.JsonWebTokenError) {
    statusCode = 401;
    message = "Invalid authorization token";
    errors = [{ error: "INVALID_TOKEN" }];
  } else if (err instanceof Error) {
    message = err.message;
  }

  if (config.NODE_ENV === "development" && errors.length === 0 && err instanceof Error) {
    errors = [{ stack: err.stack }];
  }

  res.status(statusCode).json({
    success: false,
    message,
    errors,
  });
};
