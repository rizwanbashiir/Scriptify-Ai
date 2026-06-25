import express from "express";
import {
  generateBlogDraft,
  summarizeBlog,
  generateSEOTags,
  generateThumbnail,
  generateTitles,
  improveContent,
  analyzeCommentSentiment,
} from "../../controller/ai/aiController.js";

import {
  getPersonalizedFeed,
  getSimilarBlogs,
  getTrendingBlogs,
  logReadingDuration,
} from "../../controller/ai/recommendationController.js";

import { authenticate, optionalAuthenticate } from "../../middleware/userMiddleware.js";
import { aiRateLimiter } from "../../middleware/rate.limit.middleware.js";
import { generateDraftValidator, summarizeValidator } from "../../validators/validators.js";

const router = express.Router();

// ── Public recommendation routes (no auth required) ───────────────────────────

/**
 * @swagger
 * /ai/recommendations/trending:
 *   get:
 *     summary: Get trending blog posts
 *     tags: [AI]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of trending blogs to return
 *     responses:
 *       200:
 *         description: List of trending blogs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 blogs:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Blog'
 */
router.get("/recommendations/trending", getTrendingBlogs);

/**
 * @swagger
 * /ai/recommendations/similar/{blogId}:
 *   get:
 *     summary: Get blogs similar to a given blog
 *     tags: [AI]
 *     parameters:
 *       - in: path
 *         name: blogId
 *         required: true
 *         schema:
 *           type: string
 *         description: Reference blog ID
 *         example: 64a1f2b3c4d5e6f7a8b9c0d2
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 5
 *     responses:
 *       200:
 *         description: Similar blog recommendations
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 blogs:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Blog'
 *       404:
 *         description: Reference blog not found
 */
router.get("/recommendations/similar/:blogId", getSimilarBlogs);

// ── Authenticated recommendation routes ───────────────────────────────────────

/**
 * @swagger
 * /ai/recommendations/feed:
 *   get:
 *     summary: Get a personalized blog feed for the authenticated user
 *     tags: [AI]
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
 *           default: 10
 *     responses:
 *       200:
 *         description: Personalized feed based on reading history and interests
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
router.get("/recommendations/feed", authenticate, getPersonalizedFeed);

/**
 * @swagger
 * /ai/recommendations/reading-duration:
 *   post:
 *     summary: Log reading duration for a blog (used to train recommendations)
 *     tags: [AI]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [blogId, duration]
 *             properties:
 *               blogId:
 *                 type: string
 *                 example: 64a1f2b3c4d5e6f7a8b9c0d2
 *               duration:
 *                 type: integer
 *                 description: Time spent reading in seconds
 *                 example: 120
 *     responses:
 *       200:
 *         description: Reading duration logged
 *       401:
 *         description: Unauthorized
 */
router.post("/recommendations/reading-duration", authenticate, logReadingDuration);

// ── AI features (authenticated + rate limited) ────────────────────────────────
router.use(authenticate);
router.use(aiRateLimiter);

/**
 * @swagger
 * /ai/generate-draft:
 *   post:
 *     summary: Generate an AI blog draft based on a topic
 *     tags: [AI]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [topic]
 *             properties:
 *               topic:
 *                 type: string
 *                 maxLength: 200
 *                 example: The future of AI in healthcare
 *               tone:
 *                 type: string
 *                 enum: [professional, casual, humorous, educational]
 *                 example: professional
 *               length:
 *                 type: string
 *                 enum: [short, medium, long]
 *                 default: medium
 *     responses:
 *       200:
 *         description: AI-generated blog draft
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 title:
 *                   type: string
 *                 content:
 *                   type: string
 *                 tags:
 *                   type: array
 *                   items:
 *                     type: string
 *       400:
 *         description: Validation error
 *       429:
 *         description: AI rate limit exceeded
 */
router.post("/generate-draft", generateDraftValidator, generateBlogDraft);

/**
 * @swagger
 * /ai/summarize:
 *   post:
 *     summary: Summarize a blog post using AI
 *     tags: [AI]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               blogId:
 *                 type: string
 *                 description: ID of existing blog to summarize
 *                 example: 64a1f2b3c4d5e6f7a8b9c0d2
 *               content:
 *                 type: string
 *                 minLength: 100
 *                 description: Raw content to summarize (if no blogId)
 *                 example: Artificial intelligence is transforming industries...
 *     responses:
 *       200:
 *         description: AI-generated summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 summary:
 *                   type: string
 *                 keyPoints:
 *                   type: array
 *                   items:
 *                     type: string
 *       400:
 *         description: Provide either blogId or content (min 100 chars)
 *       429:
 *         description: AI rate limit exceeded
 */
router.post("/summarize", summarizeValidator, summarizeBlog);

/**
 * @swagger
 * /ai/generate-seo-tags:
 *   post:
 *     summary: Generate SEO tags and keywords for a blog
 *     tags: [AI]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, content]
 *             properties:
 *               title:
 *                 type: string
 *                 example: Getting Started with AI Writing
 *               content:
 *                 type: string
 *                 example: In this post we explore the future of AI writing tools...
 *     responses:
 *       200:
 *         description: SEO tags and keywords
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tags:
 *                   type: array
 *                   items:
 *                     type: string
 *                 keywords:
 *                   type: array
 *                   items:
 *                     type: string
 *                 metaDescription:
 *                   type: string
 *       429:
 *         description: AI rate limit exceeded
 */
router.post("/generate-seo-tags", generateSEOTags);

/**
 * @swagger
 * /ai/generate-thumbnail:
 *   post:
 *     summary: Generate an AI thumbnail image for a blog (DALL·E 3)
 *     tags: [AI]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [prompt]
 *             properties:
 *               prompt:
 *                 type: string
 *                 example: A futuristic robot writing on a glowing keyboard
 *               style:
 *                 type: string
 *                 enum: [vivid, natural]
 *                 default: vivid
 *               size:
 *                 type: string
 *                 enum: ["1024x1024", "1792x1024", "1024x1792"]
 *                 default: "1792x1024"
 *     responses:
 *       200:
 *         description: Generated thumbnail URL
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 imageUrl:
 *                   type: string
 *                   example: https://oaidalleapiprodscus.blob.core.windows.net/...
 *       429:
 *         description: AI rate limit exceeded
 */
router.post("/generate-thumbnail", generateThumbnail);

/**
 * @swagger
 * /ai/generate-titles:
 *   post:
 *     summary: Generate multiple catchy blog titles for a topic
 *     tags: [AI]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [topic]
 *             properties:
 *               topic:
 *                 type: string
 *                 example: Machine learning for beginners
 *               count:
 *                 type: integer
 *                 default: 5
 *                 description: Number of titles to generate
 *     responses:
 *       200:
 *         description: List of generated titles
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 titles:
 *                   type: array
 *                   items:
 *                     type: string
 *       429:
 *         description: AI rate limit exceeded
 */
router.post("/generate-titles", generateTitles);

/**
 * @swagger
 * /ai/improve-content:
 *   post:
 *     summary: Improve blog content grammar and tone using AI
 *     tags: [AI]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content]
 *             properties:
 *               content:
 *                 type: string
 *                 example: this is my blog post about ai. it have many information about ai tools.
 *               tone:
 *                 type: string
 *                 enum: [professional, casual, academic, creative]
 *                 default: professional
 *     responses:
 *       200:
 *         description: Improved content
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 improvedContent:
 *                   type: string
 *                 changes:
 *                   type: array
 *                   items:
 *                     type: string
 *       429:
 *         description: AI rate limit exceeded
 */
router.post("/improve-content", improveContent);

/**
 * @swagger
 * /ai/analyze-sentiment:
 *   post:
 *     summary: Analyze sentiment of a comment or text
 *     tags: [AI]
 *     security:
 *       - BearerAuth: []
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
 *                 example: This article is absolutely amazing and very informative!
 *               commentId:
 *                 type: string
 *                 description: Optional comment ID to update its sentiment field
 *                 example: 64a1f2b3c4d5e6f7a8b9c0d3
 *     responses:
 *       200:
 *         description: Sentiment analysis result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sentiment:
 *                   type: string
 *                   enum: [positive, negative, neutral]
 *                 score:
 *                   type: number
 *                   format: float
 *                   example: 0.92
 *                 explanation:
 *                   type: string
 *       429:
 *         description: AI rate limit exceeded
 */
router.post("/analyze-sentiment", analyzeCommentSentiment);

export default router;