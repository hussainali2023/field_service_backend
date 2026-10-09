import type { Response } from "express";

export type TMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type TResponseData<T> = {
  statusCode: number;
  success: boolean;
  message: string;
  data?: T;
  meta?: TMeta;
};

export const sendResponse = <T>(res: Response, data: TResponseData<T>) => {
  res.status(data.statusCode).json({
    success: data.success,
    message: data.message,
    data: data.data,
    ...(data.meta ? { meta: data.meta } : {}),
  });
};
