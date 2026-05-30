import mongoose from "mongoose";

const blogSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },

    // Rich text / HTML content from the editor
    content: {
      type: String,
      required: [true, "Content is required"],
    },

    // Short plain-text excerpt shown in cards
    excerpt: {
      type: String,
      maxlength: [300, "Excerpt cannot exceed 300 characters"],
      default: "",
    },

    // ── AI-Generated Fields ──────────────────────────────────────────────────

    // GPT-4 generated TL;DR summary (stored at publish time, not re-generated per visit)
    aiSummary: {
      type: String,
      default: null,
    },

    // DALL·E 3 generated cover image stored on Cloudinary
    thumbnailUrl: {
      type: String,
      default: null,
    },

    thumbnailPublicId: {
      type: String,
      default: null,
    },

    // ── SEO ─────────────────────────────────────────────────────────────────
    tags: [{ type: String, trim: true, lowercase: true }],

    seoKeywords: [{ type: String, trim: true, lowercase: true }],

    metaDescription: {
      type: String,
      maxlength: [160, "Meta description cannot exceed 160 characters"],
      default: "",
    },

    // ── Categorization ───────────────────────────────────────────────────────
    category: {
      type: String,
      trim: true,
      default: "General",
    },

    // ── Status ───────────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "published",
    },

    // ── Engagement ───────────────────────────────────────────────────────────

    // Array of user IDs who liked — prevents duplicate likes
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    views: { type: Number, default: 0 },

    // Estimated reading time in minutes (~200 wpm)
    readTime: { type: Number, default: 1 },

    // ── Author ───────────────────────────────────────────────────────────────
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // ── Flags ────────────────────────────────────────────────────────────────
    isFeatured: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// ── Pre-save Hook: auto-calculate read time ──────────────────────────────────
blogSchema.pre("save", function (next) {
  if (this.isModified("content")) {
    // Strip HTML tags for word count
    const plainText = this.content.replace(/<[^>]+>/g, " ");
    const wordCount = plainText.trim().split(/\s+/).filter(Boolean).length;
    this.readTime = Math.max(1, Math.ceil(wordCount / 200));

    // Auto-generate excerpt if not set
    if (!this.excerpt && plainText.length > 0) {
      this.excerpt = plainText.substring(0, 280).trim();
    }
  }
  next();
});

// ── Indexes ──────────────────────────────────────────────────────────────────
blogSchema.index({ title: "text", content: "text", tags: "text" });
blogSchema.index({ createdAt: -1 });
blogSchema.index({ author: 1 });
blogSchema.index({ category: 1 });
blogSchema.index({ status: 1 });
blogSchema.index({ tags: 1 });

// ── Virtual: like count ───────────────────────────────────────────────────────
blogSchema.virtual("likeCount").get(function () {
  return this.likes.length;
});

const Blog = mongoose.model("Blog", blogSchema);
export default Blog;