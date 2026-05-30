import express from "express";
import {
  createBlog,
  getAllBlogs,
  getBlogById,
  updateBlog,
  deleteBlog,
  toggleLike,
  getBlogComments,
  addComment,
  deleteComment,
  getMyBlogs,
} from "../../controller/blog/blogController.js";

import { authenticate, optionalAuthenticate } from "../../middleware/userMiddleware.js";
import { authorize } from "../../middleware/role.middleware.js";
import { loadBlog, verifyBlogOwnership } from "../../middleware/blogmiddleware.js";
import { uploadThumbnail } from "../../middleware/upload.middleware.js";
import { createBlogValidator, addCommentValidator } from "../../validators/validators.js";

const router = express.Router();

// ── Public routes ──────────────────────────────────────────────────────────────
router.get("/", getAllBlogs);
router.get("/:id", optionalAuthenticate, getBlogById);
router.get("/:id/comments", getBlogComments);

// ── Authenticated routes ───────────────────────────────────────────────────────
router.use(authenticate);

router.get("/me/blogs", getMyBlogs);
router.post("/", authorize("blogger", "admin"), uploadThumbnail, createBlogValidator, createBlog);
router.put("/:id", authorize("blogger", "admin"), loadBlog, verifyBlogOwnership, uploadThumbnail, createBlogValidator, updateBlog);
router.delete("/:id", deleteBlog);
router.post("/:id/like", toggleLike);
router.post("/:id/comments", addCommentValidator, addComment);
router.delete("/:id/comments/:commentId", deleteComment);

export default router;