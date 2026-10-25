import express from "express";
import { upload } from "../middleware/multer.middleware.js";
import { uploadMedia, uploadMultipleMedia } from "../controllers/media.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

const handleMulter = (multerMiddleware) => (req, res, next) => {
  multerMiddleware(req, res, (err) => {
    if (!err) return next();
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "File too large. Please upload an image under 20MB.",
      });
    }
    return res.status(400).json({
      success: false,
      message: err.message || "Invalid file upload.",
    });
  });
};

// Single file upload route
router.post(
  "/", 
  protect, 
  handleMulter(upload.single("media")), 
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