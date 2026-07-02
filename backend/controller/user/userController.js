import User from "../../models/user/users.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import crypto from "crypto";
import { sendEmail } from "../../utils/db/email.js";

// ─── Token Helpers ─────────────────────────────────────────────────────────────

export const generateAccessToken = (user) =>
  jwt.sign({ _id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "15m",
  });

export const generateRefreshToken = (user) =>
  jwt.sign({ _id: user._id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  });

// ─── GET ALL USERS ─────────────────────────────────────────────────────────────

export const getAllUsers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    const users = await User.find({ isActive: true })
      .select("-password -refreshToken -resetOTP -resetOTPExpiry")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await User.countDocuments({ isActive: true });

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

// ─── GET USER BY ID ────────────────────────────────────────────────────────────

export const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const user = await User.findById(id)
      .select("-password -refreshToken -resetOTP -resetOTPExpiry")
      .populate("following", "firstName lastName avatar")
      .populate("followers", "firstName lastName avatar")
      .lean();

    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
};

// ─── SIGN UP ───────────────────────────────────────────────────────────────────
export const signUp = async (req, res, next) => {
  console.log("i am hereeeeeeeeee")
  try {
    let { firstName, lastName, email, mobile, password, role } = req.body;

    email = email.toLowerCase().trim();

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    const otp = crypto.randomInt(100000, 999999).toString();
    const otpHash = await bcrypt.hash(otp, 10);

    let finalRole = "reader";
    const adminEmail = process.env.ADMIN_EMAIL ? process.env.ADMIN_EMAIL.toLowerCase().trim() : "";
    const subadminEmail = process.env.SUBADMIN_EMAIL ? process.env.SUBADMIN_EMAIL.toLowerCase().trim() : "";

    if (email === adminEmail || email === subadminEmail) {
      finalRole = "admin";
    } else if (role === "blogger") {
      finalRole = "blogger";
    }

    const user = await User.create({
      firstName,
      lastName,
      email,
      mobile,
      password: hashedPassword,
      role: finalRole,
      emailVerificationOTP: otpHash,
      emailVerificationOTPExpires: new Date(Date.now() + 10 * 60 * 1000),
    });
    console.log("at line 101")

    // Always log in dev so any test email gets its OTP in the console
    if (process.env.NODE_ENV !== "production") {
      console.log(`[DEV] OTP for ${user.email}: ${otp}`);
    }

    try {
      console.log("at line 107")
      await sendEmail({
        to: user.email,
        subject: "Scriptify AI — Verify Your Email",
        html: `
          <h2>Email Verification</h2>
          <p>Your OTP is: <strong style="font-size:24px">${otp}</strong></p>
          <p>This OTP expires in <strong>10 minutes</strong>.</p>
          <p>If you did not request this, please ignore this email.</p>
        `,
      });
    } catch (emailError) {
      console.error(`Failed to send verification email to ${user.email}:`, emailError.message);
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    user.refreshToken = await bcrypt.hash(refreshToken, 10);
    await user.save();

    res.status(201).json({
      message: "Account created successfully",
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "Email already registered" });
    }
    next(error);
  }
};
// export const signUp = async (req, res, next) => {
//   try {
//     let { firstName, lastName, email, mobile, password, role } = req.body;

//     email = email.toLowerCase().trim();

//     const existingUser = await User.findOne({ email });
//     if (existingUser) {
//       return res.status(409).json({ message: "Email already registered" });
//     }

//     const salt = await bcrypt.genSalt(12);
//     const hashedPassword = await bcrypt.hash(password, salt);

//     const otp = crypto.randomInt(100000, 999999).toString();
//     const otpHash = await bcrypt.hash(otp, 10);

//     const user = await User.create({
//       firstName,
//       lastName,
//       email,
//       mobile,
//       password: hashedPassword,
//       // Only allow blogger/reader on signup; admin is set manually
//       role: role === "blogger" ? "blogger" : "reader",
//       emailVerificationOTP: otpHash,
//       emailVerificationOTPExpires: new Date(Date.now() + 10 * 60 * 1000), // 10 mins
//     });

//     await sendEmail({
//       to: user.email,
//       subject: "Scriptify AI — Verify Your Email",
//       html: `
//         <h2>Email Verification</h2>
//         <p>Your OTP is: <strong style="font-size:24px">${otp}</strong></p>
//         <p>This OTP expires in <strong>10 minutes</strong>.</p>
//         <p>If you did not request this, please ignore this email.</p>
//       `,
//     });

//     const accessToken = generateAccessToken(user);
//     const refreshToken = generateRefreshToken(user);

//     // Store hashed refresh token
//     user.refreshToken = await bcrypt.hash(refreshToken, 10);
//     await user.save();

//     res.status(201).json({
//       message: "Account created successfully",
//       user: {
//         id: user._id,
//         firstName: user.firstName,
//         lastName: user.lastName,
//         email: user.email,
//         role: user.role,
//         avatar: user.avatar,
//       },
//       accessToken,
//       refreshToken,
//     });
//   } catch (error) {
//     if (error.code === 11000) {
//       return res.status(409).json({ message: "Email already registered" });
//     }
//     next(error);
//   }
// };

// ─── SIGN IN ───────────────────────────────────────────────────────────────────

export const signIn = async (req, res, next) => {
  try {
    let { email, password } = req.body;
    email = email.toLowerCase().trim();

    const user = await User.findOne({ email }).select(
      "+password +refreshToken"
    );

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (user.isSuspended) {
      return res
        .status(403)
        .json({ message: "Your account has been suspended. Contact support." });
    }

    if (!user.isVerified && user.authProvider === "local") {
      return res
        .status(403)
        .json({ message: "Please verify your email before logging in." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const adminEmail = process.env.ADMIN_EMAIL ? process.env.ADMIN_EMAIL.toLowerCase().trim() : "";
    const subadminEmail = process.env.SUBADMIN_EMAIL ? process.env.SUBADMIN_EMAIL.toLowerCase().trim() : "";

    let roleUpdated = false;
    if (email === adminEmail || email === subadminEmail) {
      if (user.role !== "admin") {
        user.role = "admin";
        roleUpdated = true;
      }
    } else {
      if (user.role === "admin") {
        user.role = "reader"; // Security demotion
        roleUpdated = true;
      }
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    user.refreshToken = await bcrypt.hash(refreshToken, 10);
    
    // Save user if role or refresh token changed
    await user.save();

    res.status(200).json({
      message: "Login successful",
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        bio: user.bio,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    next(error);
  }
};

// ─── VERIFY EMAIL ──────────────────────────────────────────────────────────────

export const verifyEmail = async (req, res, next) => {
  try {
    let { email, otp } = req.body;
    email = email.toLowerCase().trim();

    const user = await User.findOne({ email }).select("+emailVerificationOTP +emailVerificationOTPExpires");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: "Email is already verified" });
    }

    if (!user.emailVerificationOTP || !user.emailVerificationOTPExpires) {
      return res.status(400).json({ message: "No OTP found. Please resend OTP." });
    }

    if (user.emailVerificationOTPExpires < new Date()) {
      return res.status(400).json({ message: "OTP has expired. Please resend OTP." });
    }

    const isMatch = await bcrypt.compare(otp, user.emailVerificationOTP);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    user.isVerified = true;
    user.emailVerificationOTP = undefined;
    user.emailVerificationOTPExpires = undefined;
    await user.save();

    res.status(200).json({ message: "Email verified successfully" });
  } catch (error) {
    next(error);
  }
};

// ─── RESEND OTP ────────────────────────────────────────────────────────────────

export const resendOTP = async (req, res, next) => {
  try {
    let { email } = req.body;
    email = email.toLowerCase().trim();

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: "Email is already verified" });
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    const otpHash = await bcrypt.hash(otp, 10);

    user.emailVerificationOTP = otpHash;
    user.emailVerificationOTPExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins
    await user.save();

    await sendEmail({
      to: user.email,
      subject: "Scriptify AI — Verify Your Email",
      html: `
        <h2>Email Verification</h2>
        <p>Your new OTP is: <strong style="font-size:24px">${otp}</strong></p>
        <p>This OTP expires in <strong>10 minutes</strong>.</p>
        <p>If you did not request this, please ignore this email.</p>
      `,
    });

    res.status(200).json({ message: "A new OTP has been sent to your email" });
  } catch (error) {
    next(error);
  }
};

// ─── REFRESH ACCESS TOKEN ──────────────────────────────────────────────────────

export const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      return res.status(401).json({ message: "Refresh token required" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    } catch {
      return res.status(401).json({ message: "Invalid or expired refresh token" });
    }

    const user = await User.findById(decoded._id).select("+refreshToken");
    if (!user || !user.refreshToken) {
      return res.status(401).json({ message: "Session expired. Please login again." });
    }

    const isValid = await bcrypt.compare(token, user.refreshToken);
    if (!isValid) {
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    user.refreshToken = await bcrypt.hash(newRefreshToken, 10);
    await user.save();

    res.status(200).json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch (error) {
    next(error);
  }
};

// ─── LOGOUT ────────────────────────────────────────────────────────────────────

export const logout = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (user) {
      user.refreshToken = undefined;
      await user.save();
    }
    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    next(error);
  }
};

// ─── UPDATE PROFILE ────────────────────────────────────────────────────────────

export const updateProfile = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { firstName, lastName, mobile, bio, preferredCategories } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.firstName = firstName ?? user.firstName;
    user.lastName = lastName ?? user.lastName;
    user.mobile = mobile ?? user.mobile;
    user.bio = bio ?? user.bio;
    user.preferredCategories = preferredCategories ?? user.preferredCategories;

    // If avatar was uploaded via multer/cloudinary (handled in upload middleware)
    if (req.cloudinaryUrl) {
      user.avatar = req.cloudinaryUrl;
    }

    await user.save();

    res.status(200).json({
      message: "Profile updated successfully",
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        mobile: user.mobile,
        bio: user.bio,
        avatar: user.avatar,
        role: user.role,
        preferredCategories: user.preferredCategories,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── CHANGE PASSWORD ───────────────────────────────────────────────────────────

export const changePassword = async (req, res, next) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (oldPassword === newPassword) {
      return res
        .status(400)
        .json({ message: "New password must differ from old password" });
    }

    if (newPassword.length < 8) {
      return res
        .status(400)
        .json({ message: "Password must be at least 8 characters" });
    }

    const user = await User.findById(req.user._id).select("+password");
    if (!user) return res.status(404).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Incorrect old password" });
    }

    const salt = await bcrypt.genSalt(12);
    user.password = await bcrypt.hash(newPassword, salt);
    // Invalidate all refresh tokens on password change
    user.refreshToken = undefined;
    await user.save();

    res.status(200).json({ message: "Password changed successfully" });
  } catch (error) {
    next(error);
  }
};

// ─── FORGOT PASSWORD (OTP) ────────────────────────────────────────────────────

export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email.toLowerCase().trim() }).select("+password");

    // Always return success to prevent email enumeration
    if (!user) {
      return res.status(200).json({
        message: "If that email exists, an OTP has been sent",
      });
    }

    if (!user.password) {
      // User registered only through Google OAuth and has no password
      await sendEmail({
        to: user.email,
        subject: "Scriptify AI — Password Reset Request",
        html: `
          <h2>Password Reset Request</h2>
          <p>Hello! We received a request to reset your password.</p>
          <p>However, your account is linked to Google Sign-In and does not have a password. Please return to the application and use the <strong>Sign in with Google</strong> button to log in.</p>
          <p>If you did not request this, please ignore this email.</p>
        `,
      });

      return res.status(200).json({ message: "If that email exists, an OTP has been sent" });
    }

    // Generate 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const salt = await bcrypt.genSalt(10);

    user.resetOTP = await bcrypt.hash(otp, salt);
    user.resetOTPExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await user.save();

    await sendEmail({
      to: user.email,
      subject: "Scriptify AI — Password Reset OTP",
      html: `
        <h2>Password Reset Request</h2>
        <p>Your OTP is: <strong style="font-size:24px">${otp}</strong></p>
        <p>This OTP expires in <strong>10 minutes</strong>.</p>
        <p>If you did not request this, please ignore this email.</p>
      `,
    });

    res.status(200).json({ message: "If that email exists, an OTP has been sent" });
  } catch (error) {
    next(error);
  }
};

// ─── RESET PASSWORD WITH OTP ──────────────────────────────────────────────────

export const resetPassword = async (req, res, next) => {
  try {
    const { email, otp, newPassword } = req.body;

    const user = await User.findOne({
      email: email.toLowerCase().trim(),
    }).select("+resetOTP +resetOTPExpiry +password");

    if (!user || !user.resetOTP || !user.resetOTPExpiry) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    if (user.isSuspended) {
      return res.status(403).json({ message: "Your account has been suspended. Contact support." });
    }

    if (user.resetOTPExpiry < new Date()) {
      return res.status(400).json({ message: "OTP has expired" });
    }

    const isOTPValid = await bcrypt.compare(otp, user.resetOTP);
    if (!isOTPValid) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    const salt = await bcrypt.genSalt(12);
    user.password = await bcrypt.hash(newPassword, salt);
    user.resetOTP = undefined;
    user.resetOTPExpiry = undefined;
    user.refreshToken = undefined;
    await user.save();

    res.status(200).json({ message: "Password reset successfully" });
  } catch (error) {
    next(error);
  }
};

// ─── FOLLOW / UNFOLLOW ─────────────────────────────────────────────────────────

export const toggleFollow = async (req, res, next) => {
  try {
    const { id: targetUserId } = req.params;
    const currentUserId = req.user._id;

    if (targetUserId === currentUserId.toString()) {
      return res.status(400).json({ message: "You cannot follow yourself" });
    }

    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const [currentUser, targetUser] = await Promise.all([
      User.findById(currentUserId),
      User.findById(targetUserId),
    ]);

    if (!targetUser) return res.status(404).json({ message: "User not found" });

    const isFollowing = currentUser.following.includes(targetUserId);

    if (isFollowing) {
      currentUser.following.pull(targetUserId);
      targetUser.followers.pull(currentUserId);
    } else {
      currentUser.following.push(targetUserId);
      targetUser.followers.push(currentUserId);
    }

    await Promise.all([currentUser.save(), targetUser.save()]);

    res.status(200).json({
      message: isFollowing ? "Unfollowed successfully" : "Followed successfully",
      isFollowing: !isFollowing,
    });
  } catch (error) {
    next(error);
  }
};

// ─── TOGGLE BOOKMARK ───────────────────────────────────────────────────────────

export const toggleBookmark = async (req, res, next) => {
  try {
    const { blogId } = req.params;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(blogId)) {
      return res.status(400).json({ message: "Invalid blog ID" });
    }

    const user = await User.findById(userId);
    const isBookmarked = user.bookmarks.includes(blogId);

    isBookmarked
      ? user.bookmarks.pull(blogId)
      : user.bookmarks.push(blogId);

    await user.save();

    res.status(200).json({
      message: isBookmarked ? "Bookmark removed" : "Blog bookmarked",
      isBookmarked: !isBookmarked,
    });
  } catch (error) {
    next(error);
  }
};

// ─── GET MY BOOKMARKS ──────────────────────────────────────────────────────────

export const getMyBookmarks = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .populate({
        path: "bookmarks",
        select: "title excerpt thumbnailUrl author category tags readTime createdAt",
        populate: { path: "author", select: "firstName lastName avatar" },
      })
      .lean();

    res.status(200).json(user.bookmarks || []);
  } catch (error) {
    next(error);
  }
};

// ─── DELETE USER (Admin only) ─────────────────────────────────────────────────

export const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    await user.deleteOne();
    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    next(error);
  }
};