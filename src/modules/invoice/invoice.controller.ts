import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import * as InvoiceService from "./invoice.service";

export const getAllInvoices = catchAsync(async (req: Request, res: Response) => {
  const result = await InvoiceService.getAllInvoices(req.query as any);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Invoices retrieved successfully",
    data: result.invoices,
    meta: result.meta,
  });
});

export const getMyInvoices = catchAsync(async (req: Request, res: Response) => {
  const result = await InvoiceService.getMyInvoices(req.user!.id, req.query as any);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "My invoices retrieved successfully",
    data: result.invoices,
    meta: result.meta,
  });
});

export const getInvoiceById = catchAsync(async (req: Request, res: Response) => {
  const result = await InvoiceService.getInvoiceById(req.params.id as string, req.user!);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Invoice retrieved successfully",
    data: result,
  });
});

export const createInvoice = catchAsync(async (req: Request, res: Response) => {
  const result = await InvoiceService.createInvoice(req.body, req.user!.id);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Invoice created successfully",
    data: result,
  });
});

export const cancelInvoice = catchAsync(async (req: Request, res: Response) => {
  const result = await InvoiceService.cancelInvoice(req.params.id as string, req.user!.id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Invoice cancelled successfully",
    data: result,
  });
});
