import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import * as ReviewService from "./review.service";

export const createReview = catchAsync(async (req: Request, res: Response) => {
  const result = await ReviewService.createReview(req.user!.id, req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Customer feedback submitted successfully",
    data: result,
  });
});

export const getAllReviews = catchAsync(async (req: Request, res: Response) => {
  const result = await ReviewService.getAllReviews(req.query as any);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Reviews retrieved successfully",
    data: result.reviews,
    meta: result.meta,
  });
});

export const getTechnicianReviews = catchAsync(
  async (req: Request, res: Response) => {
    const result = await ReviewService.getTechnicianReviews(
      req.params.id as string,
      req.query as any
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Technician reviews retrieved successfully",
      data: result.reviews,
      meta: result.meta,
    });
  }
);
