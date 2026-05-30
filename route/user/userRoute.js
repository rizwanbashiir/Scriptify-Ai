import express from "express";
import {
  getAllUsers,
  getUserById,
  signUp,
  signIn,
  refreshToken,
  logout,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  toggleFollow,
  toggleBookmark,
  getMyBookmarks,
  deleteUser,
} from "../../controller/user/userController.js";

import { authenticate } from "../../middleware/userMiddleware.js";
import { authorize } from "../../middleware/role.middleware.js";
import { uploadAvatar } from "../../middleware/upload.middleware.js";
import { authRateLimiter } from "../../middleware/rate.limit.middleware.js";
import {
  signUpValidator,
  signInValidator,
  changePasswordValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
} from "../../validators/validators.js";

const router = express.Router();

// ── Public routes ──────────────────────────────────────────────────────────────
router.post("/signup", authRateLimiter, signUpValidator, signUp);
router.post("/signin", authRateLimiter, signInValidator, signIn);
router.post("/refresh-token", refreshToken);
router.post("/forgot-password", authRateLimiter, forgotPasswordValidator, forgotPassword);
router.post("/reset-password", authRateLimiter, resetPasswordValidator, resetPassword);
router.get("/:id", getUserById);

// ── Authenticated routes ───────────────────────────────────────────────────────
router.use(authenticate);

router.post("/logout", logout);
router.put("/profile", uploadAvatar, updateProfile);
router.put("/change-password", changePasswordValidator, changePassword);
router.post("/:id/follow", toggleFollow);
router.post("/bookmarks/:blogId", toggleBookmark);
router.get("/me/bookmarks", getMyBookmarks);

// ── Admin only ─────────────────────────────────────────────────────────────────
router.get("/", authorize("admin"), getAllUsers);
router.delete("/:id", authorize("admin"), deleteUser);

export default router;