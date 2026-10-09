import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import * as ServiceRequestService from "./serviceRequest.service";

export const createServiceRequest = catchAsync(async (req: Request, res: Response) => {
  const result = await ServiceRequestService.createServiceRequest(req.user!.id, req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Service request created successfully",
    data: result,
  });
});

export const reviewServiceRequest = catchAsync(async (req: Request, res: Response) => {
  const result = await ServiceRequestService.reviewServiceRequest(
    req.params.id as string,
    req.user!.id,
    req.body
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Service request reviewed successfully",
    data: result,
  });
});

export const assignTechnician = catchAsync(async (req: Request, res: Response) => {
  const result = await ServiceRequestService.assignTechnician(
    req.params.id as string,
    req.user!.id,
    req.body
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Technician assigned successfully with schedule confirmed",
    data: result,
  });
});

export const updateRequestStatus = catchAsync(async (req: Request, res: Response) => {
  const result = await ServiceRequestService.updateRequestStatus(
    req.params.id as string,
    req.user!,
    req.body
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: `Service request status updated to ${req.body.status}`,
    data: result,
  });
});

export const submitServiceReport = catchAsync(async (req: Request, res: Response) => {
  const result = await ServiceRequestService.submitServiceReport(
    req.params.id as string,
    req.user!,
    req.body
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Service report submitted and work order completed",
    data: result,
  });
});

export const getAllServiceRequests = catchAsync(async (req: Request, res: Response) => {
  const result = await ServiceRequestService.getAllServiceRequests(req.query as any);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Service requests retrieved successfully",
    data: result.requests,
    meta: result.meta,
  });
});

export const getMyCustomerRequests = catchAsync(async (req: Request, res: Response) => {
  const result = await ServiceRequestService.getMyCustomerRequests(
    req.user!.id,
    req.query as any
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "My service requests retrieved successfully",
    data: result.requests,
    meta: result.meta,
  });
});

export const getMyTechnicianAssignments = catchAsync(
  async (req: Request, res: Response) => {
    const result = await ServiceRequestService.getMyTechnicianAssignments(
      req.user!.id,
      req.query as any
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "My assigned work orders retrieved successfully",
      data: result.requests,
      meta: result.meta,
    });
  }
);

export const getServiceRequestById = catchAsync(async (req: Request, res: Response) => {
  const result = await ServiceRequestService.getServiceRequestById(
    req.params.id as string,
    req.user!
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Service request details retrieved successfully",
    data: result,
  });
});

export const deleteServiceRequest = catchAsync(async (req: Request, res: Response) => {
  const result = await ServiceRequestService.deleteServiceRequest(
    req.params.id as string,
    req.user!
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.message,
    data: null,
  });
});
