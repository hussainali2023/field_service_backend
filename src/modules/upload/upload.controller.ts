import type { Request, Response } from "express";
import httpStatus from "http-status";
import { uploadToCloudinary } from "../../lib/cloudinary";
import { AppError } from "../../utils/appError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";

export const uploadSingle = catchAsync(async (req: Request, res: Response) => {
  if (!req.file) {
    throw new AppError(400, "Please provide a file to upload in the 'file' field");
  }

  const folder = (req.query.folder as string) || "field_service/general";
  const result = await uploadToCloudinary(req.file, folder);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "File uploaded successfully via Multer & Cloudinary",
    data: result,
  });
});

export const uploadMultiple = catchAsync(async (req: Request, res: Response) => {
  const files = req.files as Express.Multer.File[];
  if (!files || files.length === 0) {
    throw new AppError(400, "Please provide at least one file in the 'files' field");
  }

  const folder = (req.query.folder as string) || "field_service/attachments";
  const results = await Promise.all(
    files.map((file) => uploadToCloudinary(file, folder))
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: `${results.length} files uploaded successfully`,
    data: results,
  });
});
