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

/**
 * @swagger
 * /blogs:
 *   get:
 *     summary: Get all published blogs (paginated)
 *     tags: [Blogs]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Results per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by title or content
 *       - in: query
 *         name: tag
 *         schema:
 *           type: string
 *         description: Filter by tag
 *       - in: query
 *         name: author
 *         schema:
 *           type: string
 *         description: Filter by author ID
 *     responses:
 *       200:
 *         description: Paginated blog list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 blogs:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Blog'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 */
router.get("/", getAllBlogs);

/**
 * @swagger
 * /blogs/{id}:
 *   get:
 *     summary: Get a single blog by ID
 *     tags: [Blogs]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Blog ID
 *         example: 64a1f2b3c4d5e6f7a8b9c0d2
 *     responses:
 *       200:
 *         description: Blog details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Blog'
 *       404:
 *         description: Blog not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/:id", optionalAuthenticate, getBlogById);

/**
 * @swagger
 * /blogs/{id}/comments:
 *   get:
 *     summary: Get comments for a blog
 *     tags: [Blogs]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Blog ID
 *         example: 64a1f2b3c4d5e6f7a8b9c0d2
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: List of comments
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 comments:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Comment'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 */
router.get("/:id/comments", getBlogComments);

// ── Authenticated routes ───────────────────────────────────────────────────────
router.use(authenticate);

/**
 * @swagger
 * /blogs/me/blogs:
 *   get:
 *     summary: Get all blogs by the authenticated user
 *     tags: [Blogs]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, published]
 *         description: Filter by status
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: User's blogs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 blogs:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Blog'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         description: Unauthorized
 */
router.get("/me/blogs", getMyBlogs);

/**
 * @swagger
 * /blogs:
 *   post:
 *     summary: Create a new blog post
 *     tags: [Blogs]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [title, content]
 *             properties:
 *               title:
 *                 type: string
 *                 example: Getting Started with AI Writing
 *               content:
 *                 type: string
 *                 example: In this post we explore the future of AI...
 *               tags:
 *                 type: string
 *                 description: JSON array string of tags (e.g. `["AI","Tech"]`)
 *                 example: '["AI","Writing","Tech"]'
 *               status:
 *                 type: string
 *                 enum: [draft, published]
 *                 default: draft
 *               thumbnail:
 *                 type: string
 *                 format: binary
 *                 description: Blog cover image (JPEG/PNG)
 *     responses:
 *       201:
 *         description: Blog created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Blog'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Only bloggers and admins can create blogs
 */
router.post("/", authorize("blogger", "admin"), uploadThumbnail, createBlogValidator, createBlog);

/**
 * @swagger
 * /blogs/{id}:
 *   put:
 *     summary: Update a blog post (owner or admin)
 *     tags: [Blogs]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: 64a1f2b3c4d5e6f7a8b9c0d2
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               content:
 *                 type: string
 *               tags:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [draft, published]
 *               thumbnail:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Blog updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Blog'
 *       403:
 *         description: Not authorized to edit this blog
 *       404:
 *         description: Blog not found
 */
router.put("/:id", authorize("blogger", "admin"), loadBlog, verifyBlogOwnership, uploadThumbnail, createBlogValidator, updateBlog);

/**
 * @swagger
 * /blogs/{id}:
 *   delete:
 *     summary: Delete a blog post
 *     tags: [Blogs]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: 64a1f2b3c4d5e6f7a8b9c0d2
 *     responses:
 *       200:
 *         description: Blog deleted successfully
 *       403:
 *         description: Not authorized to delete this blog
 *       404:
 *         description: Blog not found
 */
router.delete("/:id", deleteBlog);

/**
 * @swagger
 * /blogs/{id}/like:
 *   post:
 *     summary: Like or unlike a blog (toggle)
 *     tags: [Blogs]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: 64a1f2b3c4d5e6f7a8b9c0d2
 *     responses:
 *       200:
 *         description: Like toggled
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Blog liked
 *                 liked:
 *                   type: boolean
 *                 likesCount:
 *                   type: integer
 *       401:
 *         description: Unauthorized
 */
router.post("/:id/like", toggleLike);

/**
 * @swagger
 * /blogs/{id}/comments:
 *   post:
 *     summary: Add a comment to a blog
 *     tags: [Blogs]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Blog ID
 *         example: 64a1f2b3c4d5e6f7a8b9c0d2
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [text]
 *             properties:
 *               text:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 1000
 *                 example: This is a great post!
 *     responses:
 *       201:
 *         description: Comment added
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Comment'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post("/:id/comments", addCommentValidator, addComment);

/**
 * @swagger
 * /blogs/{id}/comments/{commentId}:
 *   delete:
 *     summary: Delete a comment (author or admin)
 *     tags: [Blogs]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Blog ID
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Comment ID
 *     responses:
 *       200:
 *         description: Comment deleted
 *       403:
 *         description: Not authorized to delete this comment
 *       404:
 *         description: Comment not found
 */
router.delete("/:id/comments/:commentId", deleteComment);

export default router;