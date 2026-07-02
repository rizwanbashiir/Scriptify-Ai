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

/**
 * @swagger
 * /admin/dashboard:
 *   get:
 *     summary: Get platform dashboard statistics
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard stats
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalUsers:
 *                   type: integer
 *                   example: 1204
 *                 totalBlogs:
 *                   type: integer
 *                   example: 348
 *                 totalComments:
 *                   type: integer
 *                   example: 2156
 *                 flaggedComments:
 *                   type: integer
 *                   example: 12
 *                 newUsersToday:
 *                   type: integer
 *                   example: 8
 *                 newBlogsToday:
 *                   type: integer
 *                   example: 5
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin only
 */
router.get("/dashboard", getDashboardStats);

// ── Comment moderation ─────────────────────────────────────────────────────────

/**
 * @swagger
 * /admin/comments/flagged:
 *   get:
 *     summary: Get all flagged comments for moderation
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
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
 *         description: Flagged comments
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
 *       403:
 *         description: Forbidden
 */
router.get("/comments/flagged", getFlaggedComments);

/**
 * @swagger
 * /admin/comments/{commentId}/moderate:
 *   patch:
 *     summary: Moderate a flagged comment (approve or remove)
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Comment ID
 *         example: 64a1f2b3c4d5e6f7a8b9c0d3
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [action]
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [approve, remove]
 *                 example: approve
 *     responses:
 *       200:
 *         description: Comment moderated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Comment approved
 *       404:
 *         description: Comment not found
 *       403:
 *         description: Forbidden
 */
router.patch("/comments/:commentId/moderate", moderateComment);

// ── User management ────────────────────────────────────────────────────────────

/**
 * @swagger
 * /admin/users:
 *   get:
 *     summary: Get all users with admin-level detail
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
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
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name or email
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [user, blogger, admin]
 *       - in: query
 *         name: suspended
 *         schema:
 *           type: boolean
 *         description: Filter suspended users
 *     responses:
 *       200:
 *         description: Paginated admin user list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 users:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       403:
 *         description: Forbidden
 */
router.get("/users", adminGetAllUsers);

/**
 * @swagger
 * /admin/users/{id}/suspend:
 *   patch:
 *     summary: Suspend or unsuspend a user (toggle)
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *         example: 64a1f2b3c4d5e6f7a8b9c0d1
 *     responses:
 *       200:
 *         description: Suspension status toggled
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: User suspended
 *                 isSuspended:
 *                   type: boolean
 *       404:
 *         description: User not found
 *       403:
 *         description: Forbidden
 */
router.patch("/users/:id/suspend", toggleUserSuspension);

/**
 * @swagger
 * /admin/users/{id}/role:
 *   patch:
 *     summary: Change a user's role
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: 64a1f2b3c4d5e6f7a8b9c0d1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role]
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [user, blogger, admin]
 *                 example: blogger
 *     responses:
 *       200:
 *         description: Role updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Role changed to blogger
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       404:
 *         description: User not found
 *       403:
 *         description: Forbidden
 */
router.patch("/users/:id/role", changeUserRole);

// ── Blog management ────────────────────────────────────────────────────────────

/**
 * @swagger
 * /admin/blogs:
 *   get:
 *     summary: Get all blogs with admin-level detail
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
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
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, published]
 *       - in: query
 *         name: featured
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: All blogs with full details
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
 *       403:
 *         description: Forbidden
 */
router.get("/blogs", adminGetAllBlogs);

/**
 * @swagger
 * /admin/blogs/{id}/feature:
 *   patch:
 *     summary: Feature or unfeature a blog (toggle)
 *     tags: [Admin]
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
 *     responses:
 *       200:
 *         description: Featured status toggled
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Blog featured
 *                 isFeatured:
 *                   type: boolean
 *       404:
 *         description: Blog not found
 *       403:
 *         description: Forbidden
 */
router.patch("/blogs/:id/feature", toggleFeaturedBlog);

export default router;