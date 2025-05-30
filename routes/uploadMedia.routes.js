import express from "express";
import { upload } from "../middleware/multer.middleware.js";
import { uploadMedia, uploadMultipleMedia } from "../controllers/media.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

// Single file upload route
router.post(
  "/", 
  protect, 
  upload.single("media"), 
  uploadMedia
);

// Multiple files upload route
router.post(
  "/multiple", 
  protect, 
  upload.array("media", 10), // Allow up to 10 files
  uploadMultipleMedia
);

export default router;