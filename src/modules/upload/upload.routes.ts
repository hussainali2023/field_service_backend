import { Router } from "express";
import { auth } from "../../middleware/auth";
import { upload } from "../../lib/multer";
import * as UploadController from "./upload.controller";

const router = Router();

// File upload endpoints
router.post(
  "/single",
  auth(),
  upload.single("file"),
  UploadController.uploadSingle
);

router.post(
  "/multiple",
  auth(),
  upload.array("files", 5),
  UploadController.uploadMultiple
);

export const UploadRoutes: Router = router;
