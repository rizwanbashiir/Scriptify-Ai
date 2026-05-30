import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
      maxlength: [50, "First name cannot exceed 50 characters"],
    },

    lastName: {
      type: String,
      required: [true, "Last name is required"],
      trim: true,
      maxlength: [50, "Last name cannot exceed 50 characters"],
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },

    mobile: {
      type: String,
      trim: true,
    },

    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 8,
      select: false,
    },

    role: {
      type: String,
      enum: ["admin", "blogger", "reader"],
      default: "reader",
    },

    avatar: {
      type: String,
      default: null,
    },

    bio: {
      type: String,
      maxlength: [300, "Bio cannot exceed 300 characters"],
      default: "",
    },

    // Reading preferences for recommendation engine
    preferredCategories: [{ type: String }],

    // Accounts the user follows
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // Bookmarked blogs
    bookmarks: [{ type: mongoose.Schema.Types.ObjectId, ref: "Blog" }],

    // Account status
    isActive: { type: Boolean, default: true },
    isSuspended: { type: Boolean, default: false },

    // OTP for password reset
    resetOTP: { type: String, select: false },
    resetOTPExpiry: { type: Date, select: false },

    // Refresh token
    refreshToken: { type: String, select: false },
  },
  { timestamps: true }
);

// Virtual: full name
userSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Note: email index is already created by unique:true on the field above
userSchema.index({ role: 1 });

const User = mongoose.model("User", userSchema);
export default User;