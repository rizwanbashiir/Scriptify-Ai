import multer from "multer";
import { uploadToCloudinary } from "../utils/db/cloudinary.js";

// Use memory storage — we stream directly to Cloudinary
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only JPEG, PNG, WebP, and GIF images are allowed"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
});

/**
 * Middleware: Upload single image to Cloudinary.
 * Attaches req.cloudinaryUrl and req.cloudinaryPublicId.
 * Field name: "thumbnail"
 */
export const uploadThumbnail = [
  upload.single("thumbnail"),
  async (req, res, next) => {
    if (!req.file) return next(); // image is optional

    try {
      const { cloudinaryUrl, publicId } = await uploadToCloudinary(
        req.file.buffer,
        "scriptify-ai/thumbnails"
      );
      req.cloudinaryUrl = cloudinaryUrl;
      req.cloudinaryPublicId = publicId;
      next();
    } catch (error) {
      next(new Error("Image upload failed: " + error.message));
    }
  },
];

/**
 * Middleware: Upload user avatar to Cloudinary.
 * Field name: "avatar"
 */
export const uploadAvatar = [
  upload.single("avatar"),
  async (req, res, next) => {
    if (!req.file) return next();

    try {
      const { cloudinaryUrl, publicId } = await uploadToCloudinary(
        req.file.buffer,
        "scriptify-ai/avatars"
      );
      req.cloudinaryUrl = cloudinaryUrl;
      req.cloudinaryPublicId = publicId;
      next();
    } catch (error) {
      next(new Error("Avatar upload failed: " + error.message));
    }
  },
];