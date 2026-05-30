import express from "express";
import {
  getDashboardStats,
  getFlaggedComments,
  moderateComment,
  adminGetAllUsers,
  toggleUserSuspension,
  changeUserRole,
  adminGetAllBlogs,
  toggleFeaturedBlog,
} from "../../controller/admin/adminController.js";

import { authenticate } from "../../middleware/userMiddleware.js";
import { authorize } from "../../middleware/role.middleware.js";

const router = express.Router();

// All admin routes require authentication + admin role
router.use(authenticate);
router.use(authorize("admin"));

// ── Dashboard ──────────────────────────────────────────────────────────────────
router.get("/dashboard", getDashboardStats);

// ── Comment moderation ─────────────────────────────────────────────────────────
router.get("/comments/flagged", getFlaggedComments);
router.patch("/comments/:commentId/moderate", moderateComment);

// ── User management ────────────────────────────────────────────────────────────
router.get("/users", adminGetAllUsers);
router.patch("/users/:id/suspend", toggleUserSuspension);
router.patch("/users/:id/role", changeUserRole);

// ── Blog management ────────────────────────────────────────────────────────────
router.get("/blogs", adminGetAllBlogs);
router.patch("/blogs/:id/feature", toggleFeaturedBlog);

export default router;