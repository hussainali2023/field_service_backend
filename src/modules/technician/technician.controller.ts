import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import * as TechnicianService from "./technician.service";

export const createTechnician = catchAsync(async (req: Request, res: Response) => {
  const result = await TechnicianService.createTechnician(req.body, req.user!.id);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Technician created successfully",
    data: result,
  });
});

export const getAllTechnicians = catchAsync(async (req: Request, res: Response) => {
  const result = await TechnicianService.getAllTechnicians(req.query as any);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Technicians retrieved successfully",
    data: result.technicians,
    meta: result.meta,
  });
});

export const getTechnicianById = catchAsync(async (req: Request, res: Response) => {
  const result = await TechnicianService.getTechnicianById(req.params.id as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Technician details retrieved successfully",
    data: result,
  });
});

export const updateTechnician = catchAsync(async (req: Request, res: Response) => {
  const result = await TechnicianService.updateTechnician(
    req.params.id as string,
    req.body,
    req.user!
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Technician profile updated successfully",
    data: result,
  });
});

export const checkTechnicianAvailability = catchAsync(
  async (req: Request, res: Response) => {
    const { startDate, endDate } = req.query;
    const result = await TechnicianService.checkTechnicianAvailability(
      req.params.id as string,
      startDate as string,
      endDate as string
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Technician availability checked successfully",
      data: result,
    });
  }
);
