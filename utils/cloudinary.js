import { v2 as cloudinary } from "cloudinary";
import fs from "fs/promises";
import config from "../config/config.js";

// Configure Cloudinary
cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
});

/**
 * Uploads a file to Cloudinary and deletes it locally after upload.
 * @param {string} localFilePath - The path to the local file.
 * @returns {Promise<object|null>} Cloudinary upload response or null.
 */
const uploadOnCloudinary = async (localFilePath) => {
  if (!localFilePath) {
    console.warn("No file path provided for upload.");
    return null;
  }

  console.log(`Uploading file: ${localFilePath}`);

  try {
    const uploadPromise = cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
      timeout: 60000, // 60 seconds timeout
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Cloudinary upload timed out")), 60000)
    );

    const response = await Promise.race([uploadPromise, timeoutPromise]);

    console.log("✅ Cloudinary upload successful:", response.secure_url);

    // Delete local file
    try {
      await fs.unlink(localFilePath);
      console.log(" Local file deleted.");
    } catch (fileErr) {
      console.error(" Failed to delete local file:", fileErr.message);
    }

    return response;
  } catch (err) {
    console.error(" Cloudinary upload error:", err.message);

    // Attempt to clean up the file if upload fails
    try {
      await fs.unlink(localFilePath);
      console.log(" Local file deleted after error.");
    } catch (fileErr) {
      console.error(" Failed to delete local file after error:", fileErr.message);
    }

    throw err; // Re-throw for controller or calling function to handle
  }
};

export default uploadOnCloudinary;
