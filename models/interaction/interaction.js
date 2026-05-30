import mongoose from "mongoose";

/**
 * Tracks user interactions for the personalized recommendation engine.
 * Every view, like, and reading duration event is stored here.
 */
const interactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    blog: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Blog",
      required: true,
    },

    type: {
      type: String,
      enum: ["view", "like", "unlike", "bookmark", "comment"],
      required: true,
    },

    // Reading duration in seconds (only for type: "view")
    readingDuration: {
      type: Number,
      default: 0,
    },

    // Denormalized for faster recommendation queries
    blogCategory: { type: String },
    blogTags: [{ type: String }],
  },
  { timestamps: true }
);

// Prevent duplicate view logs within 1 hour (handled in controller)
interactionSchema.index({ user: 1, blog: 1, type: 1 });
interactionSchema.index({ user: 1, createdAt: -1 });

const Interaction = mongoose.model("Interaction", interactionSchema);
export default Interaction;