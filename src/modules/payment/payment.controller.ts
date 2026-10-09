import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import * as PaymentService from "./payment.service";

export const createCheckoutSession = catchAsync(async (req: Request, res: Response) => {
  const result = await PaymentService.createCheckoutSession(req.user!.id, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Stripe checkout session created successfully",
    data: result,
  });
});

export const verifyPayment = catchAsync(async (req: Request, res: Response) => {
  const result = await PaymentService.verifyPayment(req.body, req.user!.id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Payment successfully verified and invoice marked as paid",
    data: result,
  });
});

export const stripeWebhook = catchAsync(async (req: Request, res: Response) => {
  const sig = req.headers["stripe-signature"] as string;
  const result = await PaymentService.handleStripeWebhook(req.body, sig);

  res.status(httpStatus.OK).json(result);
});

export const getPaymentById = catchAsync(async (req: Request, res: Response) => {
  const result = await PaymentService.getPaymentById(req.params.id as string, req.user!);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Payment details retrieved successfully",
    data: result,
  });
});
