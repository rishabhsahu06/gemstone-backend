import multer from "multer";

// File filter function to validate file types
const fileFilter = (req, file, cb) => {
  // Accept images and videos
  if (file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/")) {
    cb(null, true);
  } else {
    cb(new Error("Unsupported file format. Please upload an image or video file."), false);
  }
};

// Configure memory storage (no file system writes)
const storage = multer.memoryStorage();

// Export multer instance with configuration
export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    //making 20mb limit for images and videos
    fileSize: 20 * 1024 * 1024, // 20MB limit
  },
});