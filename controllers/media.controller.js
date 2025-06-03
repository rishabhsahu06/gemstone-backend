import { catchAsync } from "../utils/catchAsync.js";
import { AppError } from "../utils/appError.js";
import uploadToCloudinary from "../utils/cloudinary.js";

// @desc    Upload media (image or video) to Cloudinary
// @route   POST /api/upload-media
// @access  Private
export const uploadMedia = catchAsync(async (req, res, next) => {
  console.log("Upload request received");
  
  // Check if file exists in the request
  if (!req.file) {
    return next(new AppError("Please upload a file", 400));
  }

  console.log(`File received: ${req.file.originalname}, size: ${req.file.size} bytes`);
  
  try {
    console.log("Starting Cloudinary upload...");
    const startTime = Date.now();
    
    // Upload to Cloudinary using buffer instead of file path
    const result = await uploadToCloudinary(req.file.buffer, {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype
    });
    
    const uploadTime = Date.now() - startTime;
    console.log(`Cloudinary upload completed in ${uploadTime}ms`);
    
    if (!result) {
      return next(new AppError("Error uploading to Cloudinary", 500));
    }

    // Return success with file details
    res.status(200).json({
      success: true,
      data: {
        url: result.secure_url,
        public_id: result.public_id,
        resource_type: result.resource_type,
        format: result.format,
        width: result.width,
        height: result.height,
        bytes: result.bytes,
        created_at: result.created_at,
        uploadTime: uploadTime
      }
    });
  } catch (error) {
    console.error("Upload error:", error);
    return next(new AppError(`Error uploading file: ${error.message}`, 500));
  }
});

// @desc    Upload multiple media files to Cloudinary
// @route   POST /api/upload-media/multiple
// @access  Private
export const uploadMultipleMedia = catchAsync(async (req, res, next) => {
  // Check if files exist in the request
  if (!req.files || req.files.length === 0) {
    return next(new AppError("Please upload at least one file", 400));
  }

  try {
    console.log(`Starting upload of ${req.files.length} files...`);
    const startTime = Date.now();
    
    // Upload all files to Cloudinary using buffers
    const uploadPromises = req.files.map(file => 
      uploadToCloudinary(file.buffer, {
        originalname: file.originalname,
        mimetype: file.mimetype
      })
    );
    
    const results = await Promise.all(uploadPromises);
    
    // Filter out any failed uploads
    const successfulUploads = results.filter(result => result !== null);
    
    const uploadTime = Date.now() - startTime;
    console.log(`Multiple upload completed in ${uploadTime}ms`);
    
    if (successfulUploads.length === 0) {
      return next(new AppError("Error uploading files to Cloudinary", 500));
    }

    // Return success with file details
    res.status(200).json({
      success: true,
      count: successfulUploads.length,
      totalFiles: req.files.length,
      uploadTime: uploadTime,
      data: successfulUploads.map(result => ({
        url: result.secure_url,
        public_id: result.public_id,
        resource_type: result.resource_type,
        format: result.format,
        width: result.width,
        height: result.height,
        bytes: result.bytes,
        created_at: result.created_at
      }))
    });
  } catch (error) {
    console.error("Multiple upload error:", error);
    return next(new AppError(`Error uploading files: ${error.message}`, 500));
  }
});