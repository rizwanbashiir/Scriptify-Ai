import Blog from "../models/blog/blogs.js";
import mongoose from "mongoose";

/**
 * Loads blog by ID and attaches to req.blog.
 * Used before update/delete to avoid loading blog twice.
 */
export const loadBlog = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid blog ID" });
    }

    const blog = await Blog.findById(id);

    if (!blog) {
      return res.status(404).json({ message: "Blog not found" });
    }

    req.blog = blog;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Verifies the authenticated user owns the blog (or is admin).
 * Must be used after loadBlog and authenticate.
 */
export const verifyBlogOwnership = (req, res, next) => {
  const blog = req.blog;
  const userId = req.user._id;

  if (
    blog.author.toString() !== userId.toString() &&
    req.user.role !== "admin"
  ) {
    return res.status(403).json({
      message: "Not authorized to modify this blog",
    });
  }

  next();
};