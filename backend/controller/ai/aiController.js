/**
 * AI Controller — All 6 AI Features from Scriptify AI Synopsis
 *
 * STACK (100% FREE — no paid API needed):
 *  Text generation / NLP  → Groq API (Mixtral)
 *  Image generation       → Pollinations.ai (free) or self-hosted Stable Diffusion
 *  Sentiment analysis     → Hugging Face Inference API (free tier)
 */

import { groqChat, parseGroqJSON } from "../../config/groq.js";
import { generateBlogThumbnail } from "../../services/image.service.js";
import { analyzeSentiment } from "../../services/huggingface.service.js";
import Blog from "../../models/blog/blogs.js";
import mongoose from "mongoose";

// ─── MODULE 3: AI WRITING ASSISTANT ───────────────────────────────────────────
// GPT-4 → Groq API

export const generateBlogDraft = async (req, res, next) => {
  try {
    const { topic, keywords, tone, wordCount } = req.body;

    if (!topic) {
      return res.status(400).json({ message: "Topic is required" });
    }

    const messages = [
      {
        role: "system",
        content:
          "You are an expert blog writer and SEO specialist. Always respond with valid JSON only — no markdown, no explanation, no preamble.",
      },
      {
        role: "user",
        content: `Write a complete, well-structured blog post on this topic:

Topic: ${topic}
${keywords ? `Keywords to include: ${keywords}` : ""}
Tone: ${tone || "Professional and engaging"}
Target length: ${wordCount || 600} words

Return ONLY this JSON structure (no other text):
{
  "title": "SEO-optimized blog title",
  "introduction": "Engaging opening paragraph",
  "sections": [
    { "heading": "Section 1 Heading", "content": "Section 1 content paragraph" },
    { "heading": "Section 2 Heading", "content": "Section 2 content paragraph" },
    { "heading": "Section 3 Heading", "content": "Section 3 content paragraph" }
  ],
  "conclusion": "Compelling conclusion paragraph",
  "suggestedTags": ["tag1", "tag2", "tag3", "tag4", "tag5"]
}`,
      },
    ];

    const raw = await groqChat(messages, { temperature: 0.7, maxTokens: 2000, format: "json" });

    let draft;
    try {
      draft = parseGroqJSON(raw);
    } catch {
      return res.status(500).json({
        message: "AI returned an unexpected format. Please retry.",
        raw,
      });
    }

    res.status(200).json({ message: "Blog draft generated successfully", draft });
  } catch (error) {
    if (error.message?.includes("Groq")) {
      return res.status(503).json({
        message: "AI service unavailable. Check your Groq API key.",
      });
    }
    next(error);
  }
};

// ─── MODULE 4: SMART BLOG SUMMARIZATION ──────────────────────────────────────

export const summarizeBlog = async (req, res, next) => {
  try {
    const { blogId, content } = req.body;

    let textToSummarize = content;

    if (blogId) {
      if (!mongoose.Types.ObjectId.isValid(blogId)) {
        return res.status(400).json({ message: "Invalid blog ID" });
      }
      const blog = await Blog.findById(blogId);
      if (!blog) return res.status(404).json({ message: "Blog not found" });

      if (
        blog.author.toString() !== req.user._id.toString() &&
        req.user.role !== "admin"
      ) {
        return res.status(403).json({ message: "Not authorized" });
      }

      textToSummarize = blog.content.replace(/<[^>]+>/g, " ");
    }

    if (!textToSummarize) {
      return res.status(400).json({ message: "Content or blogId is required" });
    }

    const messages = [
      {
        role: "system",
        content:
          "You are a precise content summarizer. Return only the summary text — no preamble, no explanation.",
      },
      {
        role: "user",
        content: `Summarize this blog post in exactly 3-5 sentences. Capture the main points and key takeaways. Write for a reader deciding if the full post is worth reading.

Content: ${textToSummarize.substring(0, 3000)}`,
      },
    ];

    const summary = await groqChat(messages, { temperature: 0.3, maxTokens: 300 });

    if (blogId) {
      await Blog.findByIdAndUpdate(blogId, { aiSummary: summary });
    }

    res.status(200).json({ message: "Summary generated successfully", summary });
  } catch (error) {
    if (error.message?.includes("Groq")) {
      return res.status(503).json({
        message: "AI service unavailable. Check your Groq API key.",
      });
    }
    next(error);
  }
};

// ─── MODULE 6: SEO TAG & KEYWORD GENERATION ───────────────────────────────────

export const generateSEOTags = async (req, res, next) => {
  try {
    const { title, content } = req.body;

    if (!title && !content) {
      return res.status(400).json({ message: "Title or content is required" });
    }

    const plainContent = content
      ? content.replace(/<[^>]+>/g, " ").substring(0, 2000)
      : "";

    const messages = [
      {
        role: "system",
        content:
          "You are an SEO specialist. Always respond with valid JSON only — no markdown, no explanation.",
      },
      {
        role: "user",
        content: `Analyze this blog post and generate SEO metadata.

Title: ${title || ""}
Content: ${plainContent}

Return ONLY this JSON (no other text):
{
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6", "tag7", "tag8"],
  "seoKeywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
  "metaDescription": "150-160 character meta description optimized for search engines",
  "category": "One of: Technology, Science, Health, Business, Culture, Education, Sports, Travel, Food, General"
}`,
      },
    ];

    const raw = await groqChat(messages, { temperature: 0.3, maxTokens: 500, format: "json" });

    let seoData;
    try {
      seoData = parseGroqJSON(raw);
    } catch {
      return res.status(500).json({
        message: "AI returned an unexpected format. Please retry.",
      });
    }

    res.status(200).json({ message: "SEO metadata generated successfully", seoData });
  } catch (error) {
    if (error.message?.includes("Groq")) {
      return res.status(503).json({
        message: "AI service unavailable. Check your Groq API key.",
      });
    }
    next(error);
  }
};

// ─── MODULE 7: AI THUMBNAIL GENERATOR (Free — Pollinations.ai) ───────────────

export const generateThumbnail = async (req, res, next) => {
  try {
    const { title, excerpt, customPrompt, blogId } = req.body;

    if (!title && !customPrompt) {
      return res.status(400).json({ message: "Title or custom prompt is required" });
    }

    const imagePrompt = customPrompt
      ? customPrompt
      : `Professional blog cover image for article titled: "${title}". ${excerpt ? `Topic: ${excerpt.substring(0, 150)}` : ""
      }. Editorial magazine style, clean, modern, no text.`;

    const { imageUrl, cloudinaryUrl, publicId } = await generateBlogThumbnail(imagePrompt);

    if (blogId && mongoose.Types.ObjectId.isValid(blogId)) {
      const blog = await Blog.findById(blogId);
      if (
        blog &&
        (blog.author.toString() === req.user._id.toString() ||
          req.user.role === "admin")
      ) {
        blog.thumbnailUrl = cloudinaryUrl || imageUrl;
        blog.thumbnailPublicId = publicId || null;
        await blog.save();
      }
    }

    res.status(200).json({
      message: "Thumbnail generated successfully",
      imageUrl: cloudinaryUrl || imageUrl,
      publicId,
    });
  } catch (error) {
    next(error);
  }
};

// ─── BONUS: TITLE GENERATOR ────────────────────────────────────────────────────

export const generateTitles = async (req, res, next) => {
  try {
    const { topic, content } = req.body;

    if (!topic && !content) {
      return res.status(400).json({ message: "Topic or content is required" });
    }

    const messages = [
      {
        role: "system",
        content:
          "You are a headline writer for a top blog platform. Return only valid JSON.",
      },
      {
        role: "user",
        content: `Generate 5 compelling, SEO-optimized blog titles.
${topic ? `Topic: ${topic}` : ""}
${content ? `Content excerpt: ${content.substring(0, 400)}` : ""}

Return ONLY a raw JSON array of exactly 5 strings, with no wrapping object and no key name, like this:
["Title 1", "Title 2", "Title 3", "Title 4", "Title 5"]`,
      },
    ];

    const raw = await groqChat(messages, { temperature: 0.8, maxTokens: 300, format: "json" });

    let titles;
    try {
      const parsed = parseGroqJSON(raw);

      if (Array.isArray(parsed)) {
        titles = parsed;
      } else if (parsed && typeof parsed === "object") {
        // Model sometimes wraps the array in an object, e.g. { "titles": [...] }
        const arrayValue = Object.values(parsed).find((v) => Array.isArray(v));
        if (!arrayValue) throw new Error("No array found in response");
        titles = arrayValue;
      } else {
        throw new Error("Not an array");
      }
    } catch (parseErr) {
      console.error("generateTitles parse failure:", parseErr.message, "raw:", raw);
      return res.status(500).json({ message: "AI error. Please retry." });
    }

    res.status(200).json({ message: "Titles generated", titles });
  } catch (error) {
    if (error.message?.includes("Groq")) {
      return res.status(503).json({
        message: "AI service unavailable. Check your Groq API key.",
      });
    }
    next(error);
  }
};

// ─── BONUS: CONTENT IMPROVEMENT ───────────────────────────────────────────────

export const improveContent = async (req, res, next) => {
  try {
    const { content, instruction } = req.body;

    if (!content) {
      return res.status(400).json({ message: "Content is required" });
    }

    const messages = [
      {
        role: "system",
        content: "You are an expert editor. Return only the improved content — no explanation, no preamble.",
      },
      {
        role: "user",
        content: `${instruction || "Improve the grammar, clarity, readability, and professional tone of this blog content. Fix all grammatical errors and awkward phrasing."}

Content:
${content}`,
      },
    ];

    const improved = await groqChat(messages, { temperature: 0.3, maxTokens: 2000 });

    res.status(200).json({ message: "Content improved successfully", improved });
  } catch (error) {
    if (error.message?.includes("Groq")) {
      return res.status(503).json({
        message: "AI service unavailable. Check your Groq API key.",
      });
    }
    next(error);
  }
};

// ─── MODULE 5: SENTIMENT ANALYSIS (standalone endpoint) ──────────────────────

export const analyzeCommentSentiment = async (req, res, next) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ message: "Text is required" });
    }

    const result = await analyzeSentiment(text);
    res.status(200).json({ message: "Sentiment analyzed", sentiment: result });
  } catch (error) {
    next(error);
  }
};