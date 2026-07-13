import mongoose from "mongoose";

const commentSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: [true, "Comment text is required"],
      trim: true,
      maxlength: [1000, "Comment cannot exceed 1000 characters"],
    },

    blog: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Blog",
      required: true,
    },

    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // ── AI Sentiment Fields (Hugging Face) ────────────────────────────────────
    sentiment: {
      label: {
        type: String,
        enum: ["POSITIVE", "NEGATIVE", "TOXIC", "NEUTRAL", "PENDING"],
        default: "PENDING",
      },
      score: {
        type: Number, // confidence score 0-1
        default: null,
      },
    },

    // If sentiment is TOXIC, auto-flag for admin review
    isFlagged: { type: Boolean, default: false },

    // Admin can approve a flagged comment or keep it hidden
    isApproved: { type: Boolean, default: true },

    // Soft delete by admin
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

commentSchema.index({ blog: 1, createdAt: -1 });
commentSchema.index({ isFlagged: 1 });
commentSchema.index({ author: 1 });

const Comment = mongoose.model("Comment", commentSchema);
export default Comment;