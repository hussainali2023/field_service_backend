import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import * as ServiceCatalogService from "./service.service";

export const createService = catchAsync(async (req: Request, res: Response) => {
  const result = await ServiceCatalogService.createService(req.body, req.user!.id);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Service created successfully",
    data: result,
  });
});

export const getAllServices = catchAsync(async (req: Request, res: Response) => {
  const result = await ServiceCatalogService.getAllServices(req.query as any);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Services retrieved successfully",
    data: result.services,
    meta: result.meta,
  });
});

export const getServiceById = catchAsync(async (req: Request, res: Response) => {
  const result = await ServiceCatalogService.getServiceById(req.params.id as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Service details retrieved successfully",
    data: result,
  });
});

export const updateService = catchAsync(async (req: Request, res: Response) => {
  const result = await ServiceCatalogService.updateService(
    req.params.id as string,
    req.body,
    req.user!.id
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Service updated successfully",
    data: result,
  });
});

export const deleteService = catchAsync(async (req: Request, res: Response) => {
  const result = await ServiceCatalogService.deleteService(
    req.params.id as string,
    req.user!.id
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.message,
    data: null,
  });
});
