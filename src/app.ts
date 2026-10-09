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



const app: Application = express();

app.use(helmet());

app.use(
  cors({
    origin: [config.CLIENT_URL, "http://localhost:3000", "http://localhost:5173"],
    credentials: true,
  })
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





app.use(notFound);
app.use(globalErrorHandler);

export default app;
