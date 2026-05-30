import User from "../../models/user/users.js";
import Blog from "../../models/blog/blogs.js";
import Comment from "../../models/comment/comments.js";
import Interaction from "../../models/interaction/interaction.js";
import mongoose from "mongoose";

// ─── DASHBOARD ANALYTICS ───────────────────────────────────────────────────────

export const getDashboardStats = async (req, res, next) => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      totalBlogs,
      totalComments,
      flaggedComments,
      newUsersThisWeek,
      newBlogsThisWeek,
      totalViews,
    ] = await Promise.all([
      User.countDocuments({ isActive: true }),
      Blog.countDocuments({ status: "published" }),
      Comment.countDocuments({ isDeleted: false }),
      Comment.countDocuments({ isFlagged: true, isDeleted: false }),
      User.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
      Blog.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
      Blog.aggregate([
        { $group: { _id: null, total: { $sum: "$views" } } },
      ]),
    ]);

    // Top 5 most viewed blogs
    const topBlogs = await Blog.find({ status: "published" })
      .populate("author", "firstName lastName")
      .select("title views likes createdAt")
      .sort({ views: -1 })
      .limit(5)
      .lean();

    // Recent user registrations
    const recentUsers = await User.find()
      .select("firstName lastName email role createdAt")
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    res.status(200).json({
      stats: {
        totalUsers,
        totalBlogs,
        totalComments,
        flaggedComments,
        newUsersThisWeek,
        newBlogsThisWeek,
        totalViews: totalViews[0]?.total || 0,
      },
      topBlogs,
      recentUsers,
    });
  } catch (error) {
    next(error);
  }
};

// ─── FLAGGED COMMENTS (Admin Moderation) ──────────────────────────────────────

export const getFlaggedComments = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const skip = (page - 1) * limit;

    const [comments, total] = await Promise.all([
      Comment.find({ isFlagged: true, isDeleted: false })
        .populate("author", "firstName lastName email avatar")
        .populate("blog", "title")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Comment.countDocuments({ isFlagged: true, isDeleted: false }),
    ]);

    res.status(200).json({ page, limit, total, comments });
  } catch (error) {
    next(error);
  }
};

// ─── APPROVE / REJECT FLAGGED COMMENT ─────────────────────────────────────────

export const moderateComment = async (req, res, next) => {
  try {
    const { commentId } = req.params;
    const { action } = req.body; // "approve" | "delete"

    if (!["approve", "delete"].includes(action)) {
      return res
        .status(400)
        .json({ message: "Action must be 'approve' or 'delete'" });
    }

    const comment = await Comment.findById(commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    if (action === "approve") {
      comment.isFlagged = false;
      comment.isApproved = true;
      await comment.save();
      return res.status(200).json({ message: "Comment approved" });
    }

    if (action === "delete") {
      comment.isDeleted = true;
      await comment.save();
      return res.status(200).json({ message: "Comment deleted" });
    }
  } catch (error) {
    next(error);
  }
};

// ─── ALL USERS (Admin) ─────────────────────────────────────────────────────────

export const adminGetAllUsers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;
    const search = req.query.search || "";
    const role = req.query.role || "";

    const query = {};
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }
    if (role) query.role = role;

    const [users, total] = await Promise.all([
      User.find(query)
        .select("-password -refreshToken -resetOTP -resetOTPExpiry")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(query),
    ]);

    res.status(200).json({
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      total,
      users,
    });
  } catch (error) {
    next(error);
  }
};

// ─── SUSPEND / UNSUSPEND USER ─────────────────────────────────────────────────

export const toggleUserSuspension = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    // Prevent admin from suspending themselves
    if (id === req.user._id.toString()) {
      return res.status(400).json({ message: "Cannot suspend your own account" });
    }

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.isSuspended = !user.isSuspended;
    // Invalidate refresh token on suspension
    if (user.isSuspended) user.refreshToken = undefined;
    await user.save();

    res.status(200).json({
      message: user.isSuspended
        ? "User suspended successfully"
        : "User unsuspended successfully",
      isSuspended: user.isSuspended,
    });
  } catch (error) {
    next(error);
  }
};

// ─── CHANGE USER ROLE ─────────────────────────────────────────────────────────

export const changeUserRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!["admin", "blogger", "reader"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const user = await User.findByIdAndUpdate(
      id,
      { role },
      { new: true, select: "-password" }
    );

    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json({ message: "User role updated", user });
  } catch (error) {
    next(error);
  }
};

// ─── ALL BLOGS (Admin) ────────────────────────────────────────────────────────

export const adminGetAllBlogs = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;
    const status = req.query.status || "";

    const query = {};
    if (status) query.status = status;

    const [blogs, total] = await Promise.all([
      Blog.find(query)
        .populate("author", "firstName lastName email")
        .select("-content -seoKeywords")
        .sort({ createdAt: -1 })
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

// ─── FEATURE / UNFEATURE BLOG ─────────────────────────────────────────────────

export const toggleFeaturedBlog = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid blog ID" });
    }

    const blog = await Blog.findById(id);
    if (!blog) return res.status(404).json({ message: "Blog not found" });

    blog.isFeatured = !blog.isFeatured;
    await blog.save();

    res.status(200).json({
      message: blog.isFeatured ? "Blog featured" : "Blog unfeatured",
      isFeatured: blog.isFeatured,
    });
  } catch (error) {
    next(error);
  }
};