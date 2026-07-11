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
 *                 page:
 *                   type: integer
 *                   example: 1
 *                 limit:
 *                   type: integer
 *                   example: 10
 *                 total:
 *                   type: integer
 *                   example: 12
 *                 isPersonalized:
 *                   type: boolean
 *                   example: true
 *                 blogs:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Blog'
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
 *               keywords:
 *                 type: string
 *                 example: artificial intelligence, medicine, diagnosis
 *               tone:
 *                 type: string
 *                 example: professional and engaging
 *               wordCount:
 *                 type: integer
 *                 default: 600
 *                 example: 600
 *     responses:
 *       200:
 *         description: AI-generated blog draft
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Blog draft generated successfully
 *                 draft:
 *                   type: object
 *                   properties:
 *                     title:
 *                       type: string
 *                       example: The Future of AI in Healthcare
 *                     introduction:
 *                       type: string
 *                       example: AI is rapidly transforming the medical industry...
 *                     sections:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           heading:
 *                             type: string
 *                             example: AI in Medical Diagnosis
 *                           content:
 *                             type: string
 *                             example: Machine learning algorithms can analyze medical images...
 *                     conclusion:
 *                       type: string
 *                       example: In conclusion, AI will enhance doctor capabilities...
 *                     suggestedTags:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["AI", "Healthcare", "Technology"]
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
 *                 message:
 *                   type: string
 *                   example: Summary generated successfully
 *                 summary:
 *                   type: string
 *                   example: This blog post explains the transition from traditional coding to AI-assisted development...
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
 *                 message:
 *                   type: string
 *                   example: SEO metadata generated successfully
 *                 seoData:
 *                   type: object
 *                   properties:
 *                     tags:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["AI", "Writing", "SEO"]
 *                     seoKeywords:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["ai tools", "writing assistant", "seo strategy"]
 *                     metaDescription:
 *                       type: string
 *                       example: Learn how to utilize AI writing assistants to optimize your blog content.
 *                     category:
 *                       type: string
 *                       example: Technology
 *       429:
 *         description: AI rate limit exceeded
 */
router.post("/generate-seo-tags", generateSEOTags);

/**
 * 
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
 *             properties:
 *               title:
 *                 type: string
 *                 example: Future of AI
 *               excerpt:
 *                 type: string
 *                 example: AI is changing the world...
 *               customPrompt:
 *                 type: string
 *                 example: A creative watercolor painting of a bright brain
 *               prompt:
 *                 type: string
 *                 example: A bright glowing brain representation
 *               blogId:
 *                 type: string
 *                 example: 64a1f2b3c4d5e6f7a8b9c0d2
 *     responses:
 *       200:
 *         description: Generated thumbnail URL
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Thumbnail generated successfully
 *                 imageUrl:
 *                   type: string
 *                   example: https://res.cloudinary.com/...
 *                 publicId:
 *                   type: string
 *                   example: scriptify-ai/thumbnails/xyz123
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
 *             properties:
 *               topic:
 *                 type: string
 *                 example: Machine learning for beginners
 *               content:
 *                 type: string
 *                 example: In this article we will explain the basics of machine learning...
 *     responses:
 *       200:
 *         description: List of generated titles
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Titles generated
 *                 titles:
 *                   type: array
 *                   items:
 *                     type: string
 *                     example: "Demystifying Machine Learning: A Beginner's Guide"
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
 *               instruction:
 *                 type: string
 *                 example: Make it sound more professional and concise.
 *     responses:
 *       200:
 *         description: Improved content
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Content improved successfully
 *                 improved:
 *                   type: string
 *                   example: This is my blog post about AI, containing comprehensive details on various AI tools.
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
 *                 message:
 *                   type: string
 *                   example: Sentiment analyzed
 *                 sentiment:
 *                   type: object
 *                   properties:
 *                     label:
 *                       type: string
 *                       enum: [POSITIVE, NEGATIVE, TOXIC, NEUTRAL]
 *                       example: POSITIVE
 *                     score:
 *                       type: number
 *                       format: float
 *                       example: 0.92
 *                     explanation:
 *                       type: string
 *                       example: The text is highly encouraging and positive.
 *                 comment:
 *                   $ref: '#/components/schemas/Comment'
 *       429:
 *         description: AI rate limit exceeded
 */
router.post("/analyze-sentiment", analyzeCommentSentiment);

export default router;