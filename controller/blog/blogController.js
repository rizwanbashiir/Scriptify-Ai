import Blog from "../../models/blog/blogs.js";
import Comment from "../../models/comment/comments.js";
import Interaction from "../../models/interaction/interaction.js";
import mongoose from "mongoose";
import { analyzeSentiment } from "../../services/huggingface.service.js";
import { deleteFromCloudinary } from "../../utils/db/cloudinary.js";

// ─── CREATE BLOG ───────────────────────────────────────────────────────────────

export const createBlog = async (req, res, next) => {
  try {
    const {
      title,
      content,
      excerpt,
      category,
      tags,
      seoKeywords,
      metaDescription,
      status,
      aiSummary,
    } = req.body;

    const blog = await Blog.create({
      title,
      content,
      excerpt,
      category,
      tags: tags ? JSON.parse(tags) : [],
      seoKeywords: seoKeywords ? JSON.parse(seoKeywords) : [],
      metaDescription,
      status: status || "published",
      aiSummary: aiSummary || null,
      // Image URL set by upload middleware (Cloudinary)
      thumbnailUrl: req.cloudinaryUrl || null,
      thumbnailPublicId: req.cloudinaryPublicId || null,
      author: req.user._id,
    });

    await blog.populate("author", "firstName lastName avatar");

    res.status(201).json({
      message: "Blog created successfully",
      blog,
    });
  } catch (error) {
    next(error);
  }
};

// ─── GET ALL BLOGS (with search, filter, pagination) ──────────────────────────

export const getAllBlogs = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const skip = (page - 1) * limit;
    const search = req.query.search || "";
    const category = req.query.category || "";
    const tag = req.query.tag || "";
    const authorId = req.query.author || "";
    const sortBy = req.query.sortBy || "latest"; // latest | popular | trending

    // Build query
    const query = { status: "published" };

    if (search) {
      query.$text = { $search: search };
    }
    if (category) query.category = category;
    if (tag) query.tags = tag;
    if (authorId && mongoose.Types.ObjectId.isValid(authorId)) {
      query.author = authorId;
    }

    // Sort strategy
    const sortMap = {
      latest: { createdAt: -1 },
      popular: { views: -1, likes: -1 },
      trending: { createdAt: -1, views: -1 },
    };
    const sort = sortMap[sortBy] || sortMap.latest;

    const [blogs, total] = await Promise.all([
      Blog.find(query)
        .populate("author", "firstName lastName avatar")
        .select("-content -seoKeywords") // exclude heavy fields from list view
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Blog.countDocuments(query),
    ]);

    res.status(200).json({
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      total,
      blogs,
    });
  } catch (error) {
    next(error);
  }
};

// ─── GET BLOG BY ID ────────────────────────────────────────────────────────────

export const getBlogById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid blog ID" });
    }

    const blog = await Blog.findById(id)
      .populate("author", "firstName lastName avatar bio followers")
      .populate({
        path: "likes",
        select: "_id",
      });

    if (!blog || blog.status === "archived") {
      return res.status(404).json({ message: "Blog not found" });
    }

    // Increment view count (non-blocking)
    Blog.findByIdAndUpdate(id, { $inc: { views: 1 } }).exec();

    // Log interaction (non-blocking, for recommendation engine)
    if (req.user) {
      Interaction.create({
        user: req.user._id,
        blog: id,
        type: "view",
        blogCategory: blog.category,
        blogTags: blog.tags,
      }).catch(() => {}); // fail silently
    }

    res.status(200).json(blog);
  } catch (error) {
    next(error);
  }
};

// ─── UPDATE BLOG ───────────────────────────────────────────────────────────────

export const updateBlog = async (req, res, next) => {
  try {
    const blog = req.blog; // attached by blog.middleware.js
    const {
      title,
      content,
      excerpt,
      category,
      tags,
      seoKeywords,
      metaDescription,
      status,
      aiSummary,
    } = req.body;

    blog.title = title ?? blog.title;
    blog.content = content ?? blog.content;
    blog.excerpt = excerpt ?? blog.excerpt;
    blog.category = category ?? blog.category;
    blog.tags = tags ? JSON.parse(tags) : blog.tags;
    blog.seoKeywords = seoKeywords ? JSON.parse(seoKeywords) : blog.seoKeywords;
    blog.metaDescription = metaDescription ?? blog.metaDescription;
    blog.status = status ?? blog.status;
    blog.aiSummary = aiSummary ?? blog.aiSummary;

    // New thumbnail uploaded
    if (req.cloudinaryUrl) {
      // Delete old image from Cloudinary
      if (blog.thumbnailPublicId) {
        await deleteFromCloudinary(blog.thumbnailPublicId);
      }
      blog.thumbnailUrl = req.cloudinaryUrl;
      blog.thumbnailPublicId = req.cloudinaryPublicId;
    }

    await blog.save();
    await blog.populate("author", "firstName lastName avatar");

    res.status(200).json({ message: "Blog updated successfully", blog });
  } catch (error) {
    next(error);
  }
};

// ─── DELETE BLOG ───────────────────────────────────────────────────────────────

export const deleteBlog = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid blog ID" });
    }

    const blog = await Blog.findById(id);
    if (!blog) return res.status(404).json({ message: "Blog not found" });

    // Only author or admin can delete
    if (
      blog.author.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to delete this blog" });
    }

    // Remove thumbnail from Cloudinary
    if (blog.thumbnailPublicId) {
      await deleteFromCloudinary(blog.thumbnailPublicId);
    }

    // Clean up related data
    await Promise.all([
      blog.deleteOne(),
      Comment.deleteMany({ blog: id }),
      Interaction.deleteMany({ blog: id }),
    ]);

    res.status(200).json({ message: "Blog deleted successfully" });
  } catch (error) {
    next(error);
  }
};

// ─── TOGGLE LIKE ───────────────────────────────────────────────────────────────

export const toggleLike = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid blog ID" });
    }

    const blog = await Blog.findById(id);
    if (!blog) return res.status(404).json({ message: "Blog not found" });

    const isLiked = blog.likes.some((uid) => uid.toString() === userId.toString());

    isLiked ? blog.likes.pull(userId) : blog.likes.push(userId);
    await blog.save();

    // Log interaction (non-blocking)
    Interaction.create({
      user: userId,
      blog: id,
      type: isLiked ? "unlike" : "like",
      blogCategory: blog.category,
      blogTags: blog.tags,
    }).catch(() => {});

    res.status(200).json({
      message: isLiked ? "Like removed" : "Blog liked",
      liked: !isLiked,
      likeCount: blog.likes.length,
    });
  } catch (error) {
    next(error);
  }
};

// ─── GET BLOG COMMENTS ─────────────────────────────────────────────────────────

export const getBlogComments = async (req, res, next) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const skip = (page - 1) * limit;

    const query = {
      blog: id,
      isDeleted: false,
      isApproved: true,
      "sentiment.label": { $ne: "TOXIC" },
    };

    const [comments, total] = await Promise.all([
      Comment.find(query)
        .populate("author", "firstName lastName avatar")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Comment.countDocuments(query),
    ]);

    res.status(200).json({ page, limit, total, comments });
  } catch (error) {
    next(error);
  }
};

// ─── ADD COMMENT (with Hugging Face sentiment) ────────────────────────────────

export const addComment = async (req, res, next) => {
  try {
    const { id: blogId } = req.params;
    const { text } = req.body;

    if (!mongoose.Types.ObjectId.isValid(blogId)) {
      return res.status(400).json({ message: "Invalid blog ID" });
    }

    const blog = await Blog.findById(blogId);
    if (!blog) return res.status(404).json({ message: "Blog not found" });

    // Run sentiment analysis (Hugging Face)
    let sentimentResult = { label: "NEUTRAL", score: null };
    try {
      sentimentResult = await analyzeSentiment(text);
    } catch {
      // Sentiment analysis is non-critical; proceed without it
    }

    const isToxic = sentimentResult.label === "TOXIC";

    const comment = await Comment.create({
      text,
      blog: blogId,
      author: req.user._id,
      sentiment: sentimentResult,
      isFlagged: isToxic,
      isApproved: !isToxic, // auto-hide toxic comments
    });

    await comment.populate("author", "firstName lastName avatar");

    // Log interaction
    Interaction.create({
      user: req.user._id,
      blog: blogId,
      type: "comment",
      blogCategory: blog.category,
      blogTags: blog.tags,
    }).catch(() => {});

    res.status(201).json({
      message: isToxic
        ? "Comment submitted and is pending review"
        : "Comment added successfully",
      comment,
    });
  } catch (error) {
    next(error);
  }
};

// ─── DELETE COMMENT ────────────────────────────────────────────────────────────

export const deleteComment = async (req, res, next) => {
  try {
    const { id: blogId, commentId } = req.params;

    const comment = await Comment.findOne({ _id: commentId, blog: blogId });
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    // Author or admin can delete
    if (
      comment.author.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to delete this comment" });
    }

    comment.isDeleted = true;
    await comment.save();

    res.status(200).json({ message: "Comment deleted" });
  } catch (error) {
    next(error);
  }
};

// ─── GET MY BLOGS ──────────────────────────────────────────────────────────────

export const getMyBlogs = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const skip = (page - 1) * limit;
    const status = req.query.status || "";

    const query = { author: req.user._id };
    if (status) query.status = status;

    const [blogs, total] = await Promise.all([
      Blog.find(query)
        .select("-content -seoKeywords")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Blog.countDocuments(query),
    ]);

    res.status(200).json({ page, limit, totalPages: Math.ceil(total / limit), total, blogs });
  } catch (error) {
    next(error);
  }
};