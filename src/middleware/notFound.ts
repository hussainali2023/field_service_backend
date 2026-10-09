import type { Request, Response } from "express";

export const notFound = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: `API Route Not Found: [${req.method}] ${req.originalUrl}`,
    errors: [{ path: req.originalUrl, message: "Route does not exist on this server" }],
  });
};
