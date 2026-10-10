import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Application, type Request, type Response } from "express";
import helmet from "helmet";
import httpStatus from "http-status";
import config from "./config";
import { globalErrorHandler } from "./middleware/globalErrorHandler";
import { notFound } from "./middleware/notFound";
import { apiLimiter } from "./middleware/rateLimiter";
import { AuthRoutes } from "./modules/auth/auth.routes";
import { UserRoutes } from "./modules/user/user.routes";
import { TechnicianRoutes } from "./modules/technician/technician.routes";
import { ServiceRoutes } from "./modules/service/service.routes";
import { ServiceRequestRoutes } from "./modules/serviceRequest/serviceRequest.routes";
import { InvoiceRoutes } from "./modules/invoice/invoice.routes";
import { PaymentRoutes } from "./modules/payment/payment.routes";
import { stripeWebhook } from "./modules/payment/payment.controller";
import { ReviewRoutes } from "./modules/review/review.routes";
import { AdminRoutes } from "./modules/admin/admin.routes";
import { UploadRoutes } from "./modules/upload/upload.routes";



const app: Application = express();

app.use(helmet());

app.use(
  cors({
    origin: ["https://field-service-frontend.vercel.app", config.CLIENT_URL, "http://localhost:3000", "http://localhost:5173"],
    credentials: true,
  })
);


// stripe
app.post(
  "/api/v1/payments/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhook
);


app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use("/api", apiLimiter);

// Health check endpoint
app.get("/", (req: Request, res: Response) => {
  res.status(httpStatus.OK).json({
    success: true,
    message: "Field Service Management System REST API is running smoothly"
  });
});

// all the routes

app.use("/api/v1/auth", AuthRoutes);
app.use("/api/v1/users", UserRoutes)
app.use("/api/v1/technicians", TechnicianRoutes);
app.use("/api/v1/services", ServiceRoutes);
app.use("/api/v1/service-requests", ServiceRequestRoutes);
app.use("/api/v1/invoices", InvoiceRoutes);
app.use("/api/v1/payments", PaymentRoutes);
app.use("/api/v1/reviews", ReviewRoutes);
app.use("/api/v1/admin", AdminRoutes);
app.use("/api/v1/upload", UploadRoutes);


app.use(notFound);
app.use(globalErrorHandler);

export default app;
