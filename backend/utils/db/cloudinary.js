import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload a file buffer (from multer) to Cloudinary
 * @param {Buffer} fileBuffer
 * @param {string} folder
 * @returns {{ cloudinaryUrl: string, publicId: string }}
 */
export const uploadToCloudinary = (fileBuffer, folder = "scriptify-ai") => {
  return new Promise((resolve, reject) => {
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      console.warn("⚠️ Cloudinary credentials missing in .env. Skipping Cloudinary upload.");
      return resolve({ cloudinaryUrl: null, publicId: null });
    }

    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        transformation: [
          { width: 1200, height: 630, crop: "fill", quality: "auto" },
        ],
      },
      (error, result) => {
        if (error) {
          console.warn("⚠️ Cloudinary upload stream failed:", error.message);
          return resolve({ cloudinaryUrl: null, publicId: null });
        }
        resolve({
          cloudinaryUrl: result.secure_url,
          publicId: result.public_id,
        });
      }
    );
    stream.end(fileBuffer);
  });
};

/**
 * Upload an image from a URL (for AI generated images)
 * @param {string} imageUrl
 * @param {string} folder
 * @returns {{ cloudinaryUrl: string|null, publicId: string|null }}
 */
export const uploadImageFromUrl = async (imageUrl, folder = "scriptify-ai") => {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.warn("⚠️ Cloudinary credentials missing in .env. Skipping Cloudinary URL upload.");
    return { cloudinaryUrl: null, publicId: null };
  }

  try {
    const result = await cloudinary.uploader.upload(imageUrl, {
      folder,
      resource_type: "image",
      transformation: [
        { width: 1200, height: 630, crop: "fill", quality: "auto" },
      ],
    });

    return {
      cloudinaryUrl: result.secure_url,
      publicId: result.public_id,
    };
  } catch (error) {
    console.warn("⚠️ Cloudinary upload from URL failed:", error.message);
    return { cloudinaryUrl: null, publicId: null };
  }
};

/**
 * Delete an image from Cloudinary by public ID
 * @param {string} publicId
 */
export const deleteFromCloudinary = async (publicId) => {
  if (!publicId || !process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    return;
  }
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error("Cloudinary delete failed:", error.message);
  }
};

export default cloudinary;