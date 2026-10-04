
import express, { type Application, type Request, type Response } from "express";
import cookieParser from "cookie-parser"

const app: Application = express();


app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());


app.get("/", (req: Request, res: Response) => {
  res.json({
    success: true,
    message: "Field Service Management System running properly",
   
  });
});


export default app;
