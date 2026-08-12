import User from "../../models/user/users.js";
import Blog from "../../models/blog/blogs.js";
import Comment from "../../models/comment/comments.js";
import Interaction from "../../models/interaction/interaction.js";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { sendEmail } from "../../utils/db/email.js";

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
      readersCount,
      bloggersCount,
      adminsCount,
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
      User.countDocuments({ role: "reader" }),
      User.countDocuments({ role: "blogger" }),
      User.countDocuments({ role: "admin" }),
    ]);

    // Compute weekly growth data for the last 4 weeks
    const growthData = [];
    const now = Date.now();
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;

    for (let i = 3; i >= 0; i--) {
      const start = new Date(now - (i + 1) * oneWeekMs);
      const end = new Date(now - i * oneWeekMs);

      const [users, blogs] = await Promise.all([
        User.countDocuments({ createdAt: { $gte: start, $lt: end } }),
        Blog.countDocuments({ createdAt: { $gte: start, $lt: end } }),
      ]);

      growthData.push({
        week: `Week ${4 - i}`,
        users,
        blogs,
      });
    }

    // Compute user distribution
    const grandTotalUsers = readersCount + bloggersCount + adminsCount || 1;
    const userDistribution = [
      {
        name: "Readers",
        value: readersCount,
        percentage: Math.round((readersCount / grandTotalUsers) * 100),
        color: "#a78bfa",
      },
      {
        name: "Bloggers",
        value: bloggersCount,
        percentage: Math.round((bloggersCount / grandTotalUsers) * 100),
        color: "#06b6d4",
      },
      {
        name: "Admins",
        value: adminsCount,
        percentage: Math.round((adminsCount / grandTotalUsers) * 100),
        color: "#f472b6",
      },
    ];

    // Top 5 most viewed blogs
    const topBlogs = await Blog.find({ status: "published" })
      .populate("author", "firstName lastName")
      .select("title views likes createdAt coverImage image thumbnail isFeatured")
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
      growthData,
      userDistribution,
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
    const { action } = req.body; // "approve" | "delete" | "remove"

    if (!["approve", "delete", "remove"].includes(action)) {
      return res
        .status(400)
        .json({ message: "Action must be 'approve', 'delete', or 'remove'" });
    }

    const comment = await Comment.findById(commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    if (action === "approve") {
      comment.isFlagged = false;
      comment.isApproved = true;
      await comment.save();
      return res.status(200).json({ message: "Comment approved", comment });
    }

    if (action === "delete" || action === "remove") {
      comment.isDeleted = true;
      comment.isFlagged = false;
      await comment.save();
      return res.status(200).json({ message: "Comment deleted", comment });
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
    const status = req.query.status || "";
    const verified = req.query.verified || "";

    const query = {};
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }
    if (role) {
      query.role = role.toLowerCase();
    }

    if (status === "active") {
      query.isSuspended = false;
      query.isActive = true;
    } else if (status === "suspended") {
      query.$or = [{ isSuspended: true }, { isActive: false }];
    }

    if (verified === "true") {
      query.isVerified = true;
    } else if (verified === "false") {
      query.isVerified = false;
    }

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

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Validate if setting to admin is allowed for this user
    if (role === "admin") {
      const adminEmail = process.env.ADMIN_EMAIL ? process.env.ADMIN_EMAIL.toLowerCase().trim() : "";
      const subadminEmail = process.env.SUBADMIN_EMAIL ? process.env.SUBADMIN_EMAIL.toLowerCase().trim() : "";
      const userEmail = user.email.toLowerCase().trim();
      if (userEmail !== adminEmail && userEmail !== subadminEmail) {
        return res.status(403).json({ message: "Only the predefined emails can be assigned the admin role" });
      }
    }

    user.role = role;
    await user.save();

    // Hide password before returning
    const userObject = user.toObject();
    delete userObject.password;

    res.status(200).json({ message: "User role updated", user: userObject });
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
    const search = req.query.search || "";
    const category = req.query.category || "";
    const featured = req.query.featured;

    const query = {};
    if (status && status !== "All Statuses") {
      query.status = status.toLowerCase();
    }
    if (category && category !== "All Categories") {
      query.category = { $regex: new RegExp(`^${category}$`, "i") };
    }
    if (featured === "true" || featured === "Featured") {
      query.isFeatured = true;
    } else if (featured === "false" || featured === "Not Featured") {
      query.isFeatured = false;
    }
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { tags: { $regex: search, $options: "i" } },
      ];
    }

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

// ─── ADMIN SIGNUP (MAX 3 ADMINS) ──────────────────────────────────────────────

export const adminSignUp = async (req, res, next) => {
  try {
    const adminCount = await User.countDocuments({ role: "admin" });
    if (adminCount >= 3) {
      return res.status(403).json({
        message: "Maximum limit of 3 admin accounts reached. No further admin accounts can be created.",
      });
    }

    let { firstName, lastName, email, mobile, password } = req.body;
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ message: "All required fields must be provided" });
    }

    email = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await bcrypt.hash(otp, 10);

    const user = await User.create({
      firstName,
      lastName,
      email,
      mobile,
      password: hashedPassword,
      role: "admin",
      emailVerificationOTP: otpHash,
      emailVerificationOTPExpires: new Date(Date.now() + 10 * 60 * 1000),
    });

    if (process.env.NODE_ENV !== "production") {
      console.log(`[DEV] Admin OTP for ${user.email}: ${otp}`);
    }

    try {
      await sendEmail({
        to: user.email,
        subject: "Scriptify AI Admin — Verify Your Email",
        html: `
          <h2>Admin Email Verification</h2>
          <p>Your OTP is: <strong style="font-size:24px">${otp}</strong></p>
          <p>This OTP expires in <strong>10 minutes</strong>.</p>
        `,
      });
    } catch (emailError) {
      console.error(`Failed to send admin verification email to ${user.email}:`, emailError.message);
    }

    res.status(201).json({
      message: "Admin account created successfully. Please verify your email.",
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── SEND HATE SPEECH WARNING EMAIL ──────────────────────────────────────────

export const sendHateSpeechWarning = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    try {
      await sendEmail({
        to: user.email,
        subject: "Scriptify AI — Official Policy Warning regarding Hate Speech",
        html: `
          <h2>Official Policy Warning</h2>
          <p>Hello ${user.firstName},</p>
          <p>We have detected a history of hateful or toxic comments from your account on Scriptify AI.</p>
          <p><strong>Please note:</strong> If you post hateful comments again, your account will be permanently suspended.</p>
          <p>Thank you for adhering to our community guidelines.</p>
        `,
      });
    } catch (emailError) {
      return res.status(500).json({ message: "Failed to send warning email", error: emailError.message });
    }

    user.hateSpeechWarningSent = true;
    await user.save();

    res.status(200).json({
      message: "Hate speech warning email sent successfully",
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        hateSpeechWarningSent: user.hateSpeechWarningSent,
        toxicCommentsCount: user.toxicCommentsCount,
      },
    });
  } catch (error) {
    next(error);
  }
};