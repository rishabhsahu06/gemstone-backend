import { v2 as cloudinary } from "cloudinary";
import { Readable } from "stream";
import config from "../config/config.js";

const getCloudinaryConfig = () => {
  const cloudName = config.cloudinary.cloudName || process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = config.cloudinary.apiKey || process.env.CLOUDINARY_API_KEY;
  const apiSecret = config.cloudinary.apiSecret || process.env.CLOUDINARY_API_SECRET;

  return { cloudName, apiKey, apiSecret };
};

const ensureCloudinaryConfigured = () => {
  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET on the backend (Vercel env vars), then redeploy."
    );
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  });
};

const uploadToCloudinary = (buffer, fileInfo = {}) => {
  ensureCloudinaryConfigured();

  return new Promise((resolve, reject) => {
    const resourceType = fileInfo.mimetype?.startsWith("video/") ? "video" : "image";

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: resourceType,
        folder: "gemstone-uploads",
        use_filename: true,
        unique_filename: true,
      },
      (error, result) => {
        if (error) {
          console.error("Cloudinary upload error:", error);
          reject(error);
        } else {
          console.log("Cloudinary upload successful:", result.public_id);
          resolve(result);
        }
      }
    );

    const bufferStream = new Readable();
    bufferStream.push(buffer);
    bufferStream.push(null);
    bufferStream.pipe(uploadStream);
  });
};

export default uploadToCloudinary;
export { cloudinary };
