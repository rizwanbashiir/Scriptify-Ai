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
router.get("/recommendations/trending", getTrendingBlogs);
router.get("/recommendations/similar/:blogId", getSimilarBlogs);

// ── Authenticated recommendation routes ───────────────────────────────────────
router.get("/recommendations/feed", authenticate, getPersonalizedFeed);
router.post("/recommendations/reading-duration", authenticate, logReadingDuration);

// ── AI features (authenticated + rate limited) ────────────────────────────────
router.use(authenticate);
router.use(aiRateLimiter);

// Module 3: AI Blog Writing Assistant
router.post("/generate-draft", generateDraftValidator, generateBlogDraft);

// Module 4: Smart Blog Summarization
router.post("/summarize", summarizeValidator, summarizeBlog);

// Module 6: SEO Tag & Keyword Generation
router.post("/generate-seo-tags", generateSEOTags);

// Module 7: AI Thumbnail Generator (DALL·E 3)
router.post("/generate-thumbnail", generateThumbnail);

// Bonus: Title generator
router.post("/generate-titles", generateTitles);

// Bonus: Content improvement (grammar / tone)
router.post("/improve-content", improveContent);

// Module 5: Comment sentiment (standalone analysis)
router.post("/analyze-sentiment", analyzeCommentSentiment);

export default router;