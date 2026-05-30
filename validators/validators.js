import { body, validationResult } from "express-validator";

// ─── Validation Result Handler ─────────────────────────────────────────────────

export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: errors.array()[0].msg,
      errors: errors.array(),
    });
  }
  next();
};

// ─── Auth Validators ───────────────────────────────────────────────────────────

export const signUpValidator = [
  body("firstName")
    .trim()
    .notEmpty().withMessage("First name is required")
    .isLength({ max: 50 }).withMessage("First name too long"),

  body("lastName")
    .trim()
    .notEmpty().withMessage("Last name is required")
    .isLength({ max: 50 }).withMessage("Last name too long"),

  body("email")
    .trim()
    .notEmpty().withMessage("Email is required")
    .isEmail().withMessage("Invalid email address")
    .normalizeEmail(),

  body("mobile")
    .optional()
    .trim()
    .isMobilePhone().withMessage("Invalid mobile number"),

  body("password")
    .notEmpty().withMessage("Password is required")
    .isLength({ min: 8 }).withMessage("Password must be at least 8 characters")
    .matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage("Password must include uppercase, lowercase, and a number"),

  handleValidationErrors,
];

export const signInValidator = [
  body("email")
    .trim()
    .notEmpty().withMessage("Email is required")
    .isEmail().withMessage("Invalid email address"),

  body("password")
    .notEmpty().withMessage("Password is required"),

  handleValidationErrors,
];

export const changePasswordValidator = [
  body("oldPassword").notEmpty().withMessage("Old password is required"),

  body("newPassword")
    .notEmpty().withMessage("New password is required")
    .isLength({ min: 8 }).withMessage("Password must be at least 8 characters")
    .matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage("Password must include uppercase, lowercase, and a number"),

  handleValidationErrors,
];

export const forgotPasswordValidator = [
  body("email")
    .trim()
    .notEmpty().withMessage("Email is required")
    .isEmail().withMessage("Invalid email address"),

  handleValidationErrors,
];

export const resetPasswordValidator = [
  body("email").trim().isEmail().withMessage("Invalid email"),
  body("otp").notEmpty().withMessage("OTP is required"),
  body("newPassword")
    .isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),

  handleValidationErrors,
];

// ─── Blog Validators ───────────────────────────────────────────────────────────

export const createBlogValidator = [
  body("title")
    .trim()
    .notEmpty().withMessage("Title is required")
    .isLength({ max: 200 }).withMessage("Title cannot exceed 200 characters"),

  body("content")
    .notEmpty().withMessage("Content is required"),

  body("status")
    .optional()
    .isIn(["draft", "published"]).withMessage("Status must be draft or published"),

  handleValidationErrors,
];

export const addCommentValidator = [
  body("text")
    .trim()
    .notEmpty().withMessage("Comment text is required")
    .isLength({ min: 2, max: 1000 }).withMessage("Comment must be between 2 and 1000 characters"),

  handleValidationErrors,
];

// ─── AI Validators ─────────────────────────────────────────────────────────────

export const generateDraftValidator = [
  body("topic")
    .trim()
    .notEmpty().withMessage("Topic is required")
    .isLength({ max: 200 }).withMessage("Topic is too long"),

  handleValidationErrors,
];

export const summarizeValidator = [
  body("blogId")
    .optional()
    .isMongoId().withMessage("Invalid blog ID"),

  body("content")
    .optional()
    .isLength({ min: 100 }).withMessage("Content must be at least 100 characters to summarize"),

  handleValidationErrors,
];